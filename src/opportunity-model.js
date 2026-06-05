export const OPPORTUNITY_FORMAT = '1';

/**
 * @param {object} input
 */
export function normalizeOpportunity(input) {
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Opportunity id is required');
  if (!input.pattern_id) throw new Error('Opportunity pattern_id is required');
  if (!Array.isArray(input.prefix_entity_ids) || input.prefix_entity_ids.length < 2) {
    throw new Error('Opportunity requires prefix_entity_ids (at least 2)');
  }
  if (!Array.isArray(input.missing_steps) || input.missing_steps.length < 1) {
    throw new Error('Opportunity requires missing_steps');
  }

  return {
    id,
    opportunity_format: OPPORTUNITY_FORMAT,
    pattern_id: input.pattern_id,
    pattern_signature: String(input.pattern_signature ?? ''),
    prefix_entity_ids: input.prefix_entity_ids,
    prefix_link_ids: input.prefix_link_ids ?? [],
    missing_steps: input.missing_steps,
    supporting_pattern_occurrences: Number(input.supporting_pattern_occurrences),
    confidence_score: Number(input.confidence_score),
    confidence_formula: String(input.confidence_formula ?? ''),
    supporting_chains: input.supporting_chains ?? [],
    reasoning_path: input.reasoning_path ?? [],
    explanation: String(input.explanation ?? ''),
    discovered_at: input.discovered_at ?? new Date().toISOString(),
    computed: true,
    source: 'pattern_store_and_vault_chains',
  };
}

/** @typedef {ReturnType<typeof normalizeOpportunity>} SeedOpportunity */
