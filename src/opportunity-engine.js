import { PatternEngine } from './pattern-engine.js';
import { stepsMatch } from './pattern-model.js';
import { OpportunityStore, opportunityIdFrom } from './opportunity-store.js';

/**
 * Opportunity Engine — historical inference from stored patterns only.
 * Never invents opportunities without pattern support.
 */
export class OpportunityEngine {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.patterns = new PatternEngine(vault);
    this.store = new OpportunityStore(vault);
    this.store.ensureReady();
  }

  /**
   * Detect completion opportunities: prefix chain matches start of a repeated pattern.
   * @param {{ minPatternOccurrences?: number, rediscoverPatterns?: boolean }} [options]
   */
  discover(options = {}) {
    const minPatternOccurrences = options.minPatternOccurrences ?? 2;
    if (options.rediscoverPatterns !== false) {
      this.patterns.discover({ minOccurrences: minPatternOccurrences });
    }

    const storedPatterns = this.patterns.list().filter(
      (p) => p.occurrence_count >= minPatternOccurrences,
    );
    const chainInstances = this.patterns.collectChainInstances();
    const opportunities = [];

    for (const instance of chainInstances) {
      const prefixSteps = instance.steps;
      const prefixLen = prefixSteps.length;

      for (const pattern of storedPatterns) {
        if (pattern.steps.length <= prefixLen) continue;
        const patternPrefix = pattern.steps.slice(0, prefixLen);
        if (!stepsMatch(prefixSteps, patternPrefix)) continue;

        if (prefixLen >= pattern.steps.length) continue;

        const missing = pattern.steps.slice(prefixLen);
        const lastEntityId = instance.entity_ids[instance.entity_ids.length - 1];
        const outgoing = this.patterns.context.links.outgoing(lastEntityId);
        if (outgoing.length > 0) continue;

        const id = opportunityIdFrom(instance.entity_ids, pattern.id);
        const confidence_score =
          pattern.confidence_score *
          (pattern.occurrence_count / (pattern.occurrence_count + 1));
        const confidence_formula =
          'pattern.confidence_score * (pattern.occurrence_count / (pattern.occurrence_count + 1))';

        const missingLabels = missing
          .map((s) => `${s.kind} "${s.display_title ?? s.title}"`)
          .join(' → ');

        opportunities.push({
          id,
          opportunity_format: '1',
          pattern_id: pattern.id,
          pattern_signature: pattern.signature,
          prefix_entity_ids: instance.entity_ids,
          prefix_link_ids: instance.link_ids,
          missing_steps: missing.map((s) => ({
            kind: s.kind,
            title: s.title,
            display_title: s.display_title ?? s.title,
          })),
          supporting_pattern_occurrences: pattern.occurrence_count,
          confidence_score,
          confidence_formula,
          supporting_chains: pattern.instances.map((inst) => ({
            entity_ids: inst.entity_ids,
            link_ids: inst.link_ids,
            reconstruction_path: inst.reconstruction_path,
          })),
          reasoning_path: [
            `Pattern ${pattern.id} observed ${pattern.occurrence_count} time(s) with signature: ${pattern.signature}.`,
            `Current chain (${prefixLen} step(s)) matches the first ${prefixLen} step(s) of that pattern.`,
            `Historical completions include: ${missingLabels}.`,
            `confidence_score = ${pattern.confidence_score} * (${pattern.occurrence_count} / (${pattern.occurrence_count} + 1)) = ${confidence_score}.`,
          ],
          explanation:
            `Completion opportunity supported by pattern observed ${pattern.occurrence_count} time(s). ` +
            `Prefix matches stored chain; missing suffix step(s): ${missingLabels}. ` +
            `Based only on stored entities, links, and patterns — not a prediction.`,
          discovered_at: new Date().toISOString(),
          computed: true,
          source: 'pattern_store_and_vault_chains',
        });
      }
    }

    const deduped = new Map();
    for (const opp of opportunities) {
      deduped.set(opp.id, opp);
    }
    const list = [...deduped.values()].sort(
      (a, b) => b.confidence_score - a.confidence_score || a.id.localeCompare(b.id),
    );

    const stored = this.store.replaceAll(list);
    return {
      discovered: list.length,
      stored,
      patterns_considered: storedPatterns.length,
      chains_scanned: chainInstances.length,
      computed: true,
      source: 'pattern_store_and_vault_chains',
    };
  }

  list() {
    return this.store.list();
  }

  get(id) {
    return this.store.get(id);
  }

  explain(id) {
    const opportunity = this.store.get(id);
    if (!opportunity) throw new Error(`Opportunity not found: ${id}`);
    const pattern = this.patterns.get(opportunity.pattern_id);
    if (!pattern) {
      throw new Error(`Supporting pattern missing: ${opportunity.pattern_id}`);
    }

    return {
      opportunity,
      originating_pattern: {
        id: pattern.id,
        signature: pattern.signature,
        occurrence_count: pattern.occurrence_count,
        steps: pattern.steps,
      },
      supporting_chains: opportunity.supporting_chains,
      reasoning_path: opportunity.reasoning_path,
      explanation: opportunity.explanation,
      metrics: {
        confidence_score: opportunity.confidence_score,
        confidence_formula: opportunity.confidence_formula,
        supporting_pattern_occurrences: opportunity.supporting_pattern_occurrences,
      },
      computed: true,
      source: 'pattern_store_and_vault_chains',
    };
  }

  rank() {
    return this.list().map((o, index) => ({
      rank: index + 1,
      id: o.id,
      confidence_score: o.confidence_score,
      supporting_pattern_occurrences: o.supporting_pattern_occurrences,
      pattern_id: o.pattern_id,
      missing_steps: o.missing_steps,
      computed: true,
      source: 'opportunity_store',
    }));
  }
}
