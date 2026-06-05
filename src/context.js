import { TRANSFORMATION_CHAIN } from './model.js';
import { RELATION_KINDS } from './links-model.js';
import { LinkStore } from './link-store.js';

/**
 * Context Engine — connects Vault entities into traceable transformation chains.
 * Deterministic, explainable, local-only.
 */
export class ContextEngine {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.links = new LinkStore(vault);
    vault.open();
    this.links.ensureReady();
  }

  /** @param {string} fromId @param {string} toId */
  connect(fromId, toId) {
    return this.links.create(fromId, toId);
  }

  /**
   * Walk forward along a single chain path (deterministic: earliest link first).
   * @param {string} entityId
   * @returns {{ entities: import('./model.js').SeedEntity[], links: import('./links-model.js').SeedLink[] }}
   */
  traceForward(entityId) {
    const start = this.vault.get(entityId);
    if (!start) throw new Error(`Entity not found: ${entityId}`);

    const entities = [start];
    const linksUsed = [];
    let current = start;

    while (true) {
      const nextLinks = this.links
        .outgoing(current.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (nextLinks.length === 0) break;

      const link = nextLinks[0];
      const next = this.vault.get(link.to);
      if (!next) break;
      linksUsed.push(link);
      entities.push(next);
      current = next;
    }

    return { entities, links: linksUsed };
  }

  /**
   * Walk backward to origin (deterministic: earliest incoming link first).
   * @param {string} entityId
   */
  traceBackward(entityId) {
    const start = this.vault.get(entityId);
    if (!start) throw new Error(`Entity not found: ${entityId}`);

    const entities = [start];
    const linksUsed = [];
    let current = start;

    while (true) {
      const prevLinks = this.links
        .incoming(current.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (prevLinks.length === 0) break;

      const link = prevLinks[0];
      const prev = this.vault.get(link.from);
      if (!prev) break;
      linksUsed.unshift(link);
      entities.unshift(prev);
      current = prev;
    }

    return { entities, links: linksUsed };
  }

  /**
   * Full chain reconstruction from any node: origin … node … impact
   * @param {string} entityId
   */
  reconstructChain(entityId) {
    const back = this.traceBackward(entityId);
    const fwd = this.traceForward(entityId);
    const entities = [...back.entities, ...fwd.entities.slice(1)];
    const links = [...back.links, ...fwd.links];
    return {
      entityId,
      entities,
      links,
      origin: entities[0] ?? null,
      impact: entities[entities.length - 1] ?? null,
      complete:
        entities.length > 0 &&
        entities[0].kind === 'origin' &&
        entities[entities.length - 1].kind === 'impact' &&
        entities.length === TRANSFORMATION_CHAIN.length,
    };
  }

  /** Relationship graph: all stored entities and links (explicit, no inference). */
  getGraph() {
    const entities = this.vault.list();
    const links = this.links.list();
    return {
      nodes: entities.map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
      })),
      edges: links.map((l) => ({
        id: l.id,
        from: l.from,
        to: l.to,
        relation: l.relation,
        label: `${RELATION_KINDS[l.relation].from} → ${RELATION_KINDS[l.relation].to}`,
      })),
      stored: {
        entity_count: entities.length,
        link_count: links.length,
        local_only: true,
      },
    };
  }

  /**
   * Explainable context for one entity.
   * @param {string} entityId
   */
  explain(entityId) {
    const entity = this.vault.get(entityId);
    if (!entity) throw new Error(`Entity not found: ${entityId}`);
    const chain = this.reconstructChain(entityId);
    const incoming = this.links.incoming(entityId);
    const outgoing = this.links.outgoing(entityId);

    return {
      entity,
      chain: chain.entities.map((e) => ({ id: e.id, kind: e.kind, title: e.title })),
      links: {
        incoming: incoming.map((l) => ({ id: l.id, from: l.from, relation: l.relation })),
        outgoing: outgoing.map((l) => ({ id: l.id, to: l.to, relation: l.relation })),
      },
      navigation: {
        can_trace_to_origin: chain.entities[0]?.kind === 'origin',
        can_trace_to_impact: chain.entities[chain.entities.length - 1]?.kind === 'impact',
      },
      computed: false,
      source: 'vault_entities_and_links',
    };
  }
}
