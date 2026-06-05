import { TRANSFORMATION_CHAIN } from '../model.js';
import { projectSummaries } from './projects.js';

/**
 * Deterministic analysis over stored vault data only.
 */
export class SystemAnalyzer {
  /**
   * @param {import('./system.js').SeedSystem} system
   */
  constructor(system) {
    this.system = system;
  }

  dashboard() {
    const vault = this.system.vault;
    const entities = vault.list();
    const links = this.system.links.list();
    const patterns = this.system.patterns.list();
    const opportunities = this.system.opportunities.list();
    const incomplete = this.incompleteChains();
    const stalled = this.stalledItems();
    const gaps = this.suspiciousGaps();
    const recent = this.recentActivity(8);

    const brief = this.dailyBrief();

    return {
      counts: {
        entities: entities.length,
        links: links.length,
        patterns: patterns.length,
        opportunities: opportunities.length,
        projects: projectSummaries(this.system).length,
      },
      stalled_count: stalled.length,
      incomplete_chain_count: incomplete.length,
      gap_count: gaps.length,
      risks_count: stalled.length + gaps.length,
      recent_activity: recent,
      focus_now: brief.priorities.slice(0, 5),
      projects: projectSummaries(this.system),
      system_health: this.health(),
      mode: 'offline',
      source_of_truth: this.system.vaultPath,
      computed: true,
    };
  }

  health() {
    const manifest = this.system.vault.getManifest();
    const incomplete = this.incompleteChains();
    const patterns = this.system.patterns.list();
    let status = 'healthy';
    const notes = [];

    if (incomplete.length > 0) {
      status = 'attention';
      notes.push(`${incomplete.length} incomplete transformation chain(s).`);
    }
    if (patterns.length === 0 && this.system.links.list().length >= 4) {
      notes.push('Patterns not indexed yet; refresh will scan chains.');
    }
    if (this.system.vault.list().length === 0) {
      status = 'empty';
      notes.push('Vault has no entities. Add origins and decisions to begin.');
    }

    return {
      status,
      notes,
      manifest_updated_at: manifest.updated_at,
      computed: true,
    };
  }

  /** Chains that do not reach origin → impact. */
  incompleteChains() {
    const results = [];
    const seen = new Set();

    for (const entity of this.system.vault.list()) {
      const chain = this.system.context.reconstructChain(entity.id);
      const key = chain.entities.map((e) => e.id).join('>');
      if (seen.has(key)) continue;
      seen.add(key);

      if (chain.complete) continue;
      if (chain.entities.length < 2) continue;

      const last = chain.entities[chain.entities.length - 1];
      const missingKinds = [];
      const lastIdx = TRANSFORMATION_CHAIN.indexOf(last.kind);
      for (let i = lastIdx + 1; i < TRANSFORMATION_CHAIN.length; i += 1) {
        missingKinds.push(TRANSFORMATION_CHAIN[i]);
      }

      results.push({
        chain_entity_ids: chain.entities.map((e) => e.id),
        chain_titles: chain.entities.map((e) => e.title),
        chain_kinds: chain.entities.map((e) => e.kind),
        ends_at_kind: last.kind,
        missing_kinds: missingKinds,
        link_ids: chain.links.map((l) => l.id),
        evidence: {
          entity_ids: chain.entities.map((e) => e.id),
          link_ids: chain.links.map((l) => l.id),
        },
      });
    }

    return results.sort((a, b) => a.ends_at_kind.localeCompare(b.ends_at_kind));
  }

  /** Entities that stop before impact with no forward link. */
  stalledItems() {
    const stalled = [];
    for (const entity of this.system.vault.list()) {
      if (entity.kind === 'impact') continue;
      const outgoing = this.system.links.outgoing(entity.id);
      if (outgoing.length > 0) continue;

      const chain = this.system.context.reconstructChain(entity.id);
      if (chain.complete) continue;

      stalled.push({
        id: entity.id,
        kind: entity.kind,
        title: entity.title,
        updated_at: entity.updated_at,
        reason: `No forward link from ${entity.kind}; chain does not reach impact.`,
        evidence: { entity_id: entity.id, chain_entity_ids: chain.entities.map((e) => e.id) },
      });
    }
    return stalled.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  /** Origins without outgoing, decisions isolated, etc. */
  suspiciousGaps() {
    const gaps = [];
    for (const entity of this.system.vault.list()) {
      const incoming = this.system.links.incoming(entity.id);
      const outgoing = this.system.links.outgoing(entity.id);

      if (entity.kind === 'origin' && outgoing.length === 0) {
        gaps.push({
          type: 'origin_without_decision',
          entity_id: entity.id,
          title: entity.title,
          evidence: { entity_id: entity.id },
        });
      }
      if (entity.kind !== 'origin' && incoming.length === 0) {
        gaps.push({
          type: 'orphan_no_incoming',
          entity_id: entity.id,
          kind: entity.kind,
          title: entity.title,
          evidence: { entity_id: entity.id },
        });
      }
    }
    return gaps;
  }

  recentActivity(limit = 10) {
    return this.system.vault
      .list()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        updated_at: e.updated_at,
        evidence: { entity_id: e.id },
      }));
  }

  recurringSuccesses() {
    return this.system.patterns
      .list()
      .filter((p) => p.occurrence_count >= 2)
      .map((p) => ({
        pattern_id: p.id,
        occurrence_count: p.occurrence_count,
        confidence_score: p.confidence_score,
        steps: p.steps.map((s) => `${s.kind}: ${s.display_title ?? s.title}`),
        explanation: p.explanation,
        evidence: {
          pattern_id: p.id,
          source_entity_ids: p.source_entity_ids,
          source_link_ids: p.source_link_ids,
        },
      }));
  }

  dailyBrief() {
    const opportunities = this.system.opportunities.list().slice(0, 5);
    const incomplete = this.incompleteChains().slice(0, 5);
    const stalled = this.stalledItems().slice(0, 5);
    const patterns = this.recurringSuccesses().slice(0, 3);

    return {
      priorities: [
        ...opportunities.map((o) => ({
          type: 'opportunity',
          summary: `Complete ${o.missing_steps.map((s) => s.kind).join(' → ')} (supported ${o.supporting_pattern_occurrences}×)`,
          opportunity_id: o.id,
          pattern_id: o.pattern_id,
          confidence_score: o.confidence_score,
          evidence: { opportunity_id: o.id, pattern_id: o.pattern_id },
        })),
        ...stalled.map((s) => ({
          type: 'stalled',
          summary: `${s.kind} "${s.title}" — ${s.reason}`,
          evidence: s.evidence,
        })),
      ],
      incomplete_chains: incomplete,
      top_patterns: patterns,
      computed: true,
    };
  }
}
