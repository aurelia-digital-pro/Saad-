import { ContextEngine } from './context.js';
import {
  chainStepsFromEntities,
  computeConfidence,
  isValidKindSequence,
  normalizeTitle,
  signatureFromEntities,
  signatureFromSteps,
  stepsMatch,
} from './pattern-model.js';
import { PatternStore, deterministicIdFromSignature } from './pattern-store.js';

/**
 * Pattern Engine — deterministic structural repetition from stored chains only.
 */
export class PatternEngine {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.context = new ContextEngine(vault);
    this.store = new PatternStore(vault);
    this.store.ensureReady();
  }

  /**
   * Enumerate unique chain instances from vault (stored links only).
   */
  collectChainInstances() {
    const entities = this.vault.list();
    const byKey = new Map();

    for (const entity of entities) {
      const chain = this.context.reconstructChain(entity.id);
      if (chain.entities.length < 2) continue;
      if (!isValidKindSequence(chain.entities)) continue;

      const key = chain.entities.map((e) => e.id).join('>');
      if (byKey.has(key)) continue;

      const steps = chainStepsFromEntities(chain.entities);
      const timestamps = chain.entities.map((e) => e.created_at).sort();

      byKey.set(key, {
        entity_ids: chain.entities.map((e) => e.id),
        link_ids: chain.links.map((l) => l.id),
        reconstruction_path: chain.entities.map((e) => e.id),
        steps,
        signature: signatureFromSteps(steps),
        first_observed_at: timestamps[0],
        last_observed_at: timestamps[timestamps.length - 1],
        entities: chain.entities,
        links: chain.links,
      });
    }

    return [...byKey.values()];
  }

  /**
   * Discover repeated structural patterns and persist them.
   * @param {{ minOccurrences?: number }} [options]
   */
  discover(options = {}) {
    const minOccurrences = options.minOccurrences ?? 2;
    const instances = this.collectChainInstances();
    const totalChainsScanned = instances.length;

    /** @type {Map<string, typeof instances>} */
    const groups = new Map();
    for (const instance of instances) {
      const list = groups.get(instance.signature) ?? [];
      list.push(instance);
      groups.set(instance.signature, list);
    }

    const patterns = [];
    for (const [signature, group] of groups) {
      if (group.length < minOccurrences) continue;

      const steps = group[0].steps.map((s) => ({
        kind: s.kind,
        title: s.title,
        display_title: s.display_title,
      }));

      const allEntityIds = [...new Set(group.flatMap((g) => g.entity_ids))];
      const allLinkIds = [...new Set(group.flatMap((g) => g.link_ids))];
      const observedAts = group.flatMap((g) => [g.first_observed_at, g.last_observed_at]).sort();
      const { confidence_score, recurrence_frequency, confidence_formula } = computeConfidence(
        group.length,
        totalChainsScanned,
      );

      const id = deterministicIdFromSignature('pattern', signature);
      const stepLabels = steps.map((s) => `${s.kind} "${s.display_title}"`).join(' → ');

      patterns.push({
        id,
        pattern_format: '1',
        signature,
        steps,
        occurrence_count: group.length,
        recurrence_frequency,
        confidence_score,
        confidence_formula,
        first_seen: observedAts[0],
        last_seen: observedAts[observedAts.length - 1],
        instances: group.map((g) => ({
          entity_ids: g.entity_ids,
          link_ids: g.link_ids,
          reconstruction_path: g.reconstruction_path,
          observed_at: g.last_observed_at,
        })),
        source_entity_ids: allEntityIds,
        source_link_ids: allLinkIds,
        explanation:
          `Repeated transformation chain observed ${group.length} time(s) out of ${totalChainsScanned} scanned chain(s). ` +
          `Structural signature: ${signature}. Path: ${stepLabels}. ` +
          `confidence_score = ${group.length} / ${totalChainsScanned} = ${confidence_score}.`,
        discovered_at: new Date().toISOString(),
        computed: true,
        source: 'vault_entities_and_links',
      });
    }

    patterns.sort((a, b) => b.occurrence_count - a.occurrence_count || a.signature.localeCompare(b.signature));
    const stored = this.store.replaceAll(patterns);

    return {
      discovered: patterns.length,
      stored,
      total_chains_scanned: totalChainsScanned,
      computed: true,
      source: 'vault_entities_and_links',
    };
  }

  list() {
    return this.store.list();
  }

  get(id) {
    return this.store.get(id);
  }

  getIndex() {
    return this.store.readIndex();
  }

  /**
   * @param {string} patternId
   * @param {number} [instanceIndex]
   */
  reconstruct(patternId, instanceIndex = 0) {
    const pattern = this.store.get(patternId);
    if (!pattern) throw new Error(`Pattern not found: ${patternId}`);
    const instance = pattern.instances[instanceIndex];
    if (!instance) throw new Error(`Instance index ${instanceIndex} not found`);

    const entities = instance.entity_ids.map((id) => {
      const e = this.vault.get(id);
      if (!e) throw new Error(`Source entity missing: ${id}`);
      return e;
    });
    const links = instance.link_ids.map((id) => {
      const l = this.context.links.get(id);
      if (!l) throw new Error(`Source link missing: ${id}`);
      return l;
    });

    return {
      pattern_id: patternId,
      instance_index: instanceIndex,
      entities,
      links,
      reconstruction_path: instance.reconstruction_path,
      computed: false,
      source: 'vault_entities_and_links',
    };
  }

  explain(patternId) {
    const pattern = this.store.get(patternId);
    if (!pattern) throw new Error(`Pattern not found: ${patternId}`);

    return {
      pattern,
      source_entity_ids: pattern.source_entity_ids,
      source_link_ids: pattern.source_link_ids,
      reconstruction_paths: pattern.instances.map((i) => i.reconstruction_path),
      explanation: pattern.explanation,
      metrics: {
        occurrence_count: pattern.occurrence_count,
        recurrence_frequency: pattern.recurrence_frequency,
        confidence_score: pattern.confidence_score,
        confidence_formula: pattern.confidence_formula,
        first_seen: pattern.first_seen,
        last_seen: pattern.last_seen,
      },
      computed: true,
      source: 'vault_entities_and_links',
    };
  }
}

export { signatureFromEntities, stepsMatch, normalizeTitle };
