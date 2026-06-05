import { TRANSFORMATION_CHAIN } from './model.js';

export const PATTERN_FORMAT = '1';

/**
 * Normalize title for deterministic structural comparison.
 * @param {string} title
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {import('./model.js').SeedEntity[]} entities
 */
export function chainStepsFromEntities(entities) {
  return entities.map((e) => ({
    kind: e.kind,
    title: normalizeTitle(e.title),
    display_title: String(e.title ?? '').trim(),
  }));
}

/**
 * @param {{ kind: string, title: string }[]} steps
 */
export function signatureFromSteps(steps) {
  return steps.map((s) => `${s.kind}:${s.title}`).join('|');
}

/**
 * @param {import('./model.js').SeedEntity[]} entities
 */
export function signatureFromEntities(entities) {
  return signatureFromSteps(chainStepsFromEntities(entities));
}

export function stepsMatch(a, b) {
  if (a.length !== b.length) return false;
  return a.every((step, i) => step.kind === b[i].kind && step.title === b[i].title);
}

export function isValidKindSequence(entities) {
  let chainIndex = -1;
  for (const entity of entities) {
    const idx = TRANSFORMATION_CHAIN.indexOf(entity.kind);
    if (idx <= chainIndex) return false;
    chainIndex = idx;
  }
  return true;
}

/**
 * Documented confidence: occurrence_count / total_chains_scanned (0 if count < 2).
 * @param {number} occurrenceCount
 * @param {number} totalChainsScanned
 */
export function computeConfidence(occurrenceCount, totalChainsScanned) {
  if (totalChainsScanned <= 0 || occurrenceCount < 2) {
    return {
      confidence_score: 0,
      recurrence_frequency: 0,
      confidence_formula: 'occurrence_count / total_chains_scanned (requires occurrence_count >= 2)',
    };
  }
  const recurrence_frequency = occurrenceCount / totalChainsScanned;
  return {
    confidence_score: recurrence_frequency,
    recurrence_frequency,
    confidence_formula: 'occurrence_count / total_chains_scanned',
  };
}

/**
 * @param {object} input
 */
export function normalizePattern(input) {
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Pattern id is required');
  if (!Array.isArray(input.steps) || input.steps.length < 2) {
    throw new Error('Pattern requires at least 2 steps');
  }
  if (!Array.isArray(input.instances) || input.instances.length < 1) {
    throw new Error('Pattern requires at least one instance');
  }

  return {
    id,
    pattern_format: PATTERN_FORMAT,
    signature: String(input.signature ?? ''),
    steps: input.steps,
    occurrence_count: Number(input.occurrence_count),
    recurrence_frequency: Number(input.recurrence_frequency),
    confidence_score: Number(input.confidence_score),
    confidence_formula: String(input.confidence_formula ?? ''),
    first_seen: input.first_seen,
    last_seen: input.last_seen,
    instances: input.instances,
    source_entity_ids: input.source_entity_ids ?? [],
    source_link_ids: input.source_link_ids ?? [],
    explanation: String(input.explanation ?? ''),
    discovered_at: input.discovered_at ?? new Date().toISOString(),
    computed: true,
    source: 'vault_entities_and_links',
  };
}

/** @typedef {ReturnType<typeof normalizePattern>} SeedPattern */
