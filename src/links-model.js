import { TRANSFORMATION_CHAIN } from './model.js';

/**
 * Valid directed edges along the transformation invariant:
 * Origin → Decision → Action → Result → Impact
 */
export const CHAIN_RELATIONS = Object.freeze([
  'origin_to_decision',
  'decision_to_action',
  'action_to_result',
  'result_to_impact',
]);

/** @type {Record<string, { from: string, to: string }>} */
export const RELATION_KINDS = Object.freeze({
  origin_to_decision: { from: 'origin', to: 'decision' },
  decision_to_action: { from: 'decision', to: 'action' },
  action_to_result: { from: 'action', to: 'result' },
  result_to_impact: { from: 'result', to: 'impact' },
});

export function relationForKinds(fromKind, toKind) {
  for (const [relation, kinds] of Object.entries(RELATION_KINDS)) {
    if (kinds.from === fromKind && kinds.to === toKind) {
      return relation;
    }
  }
  throw new Error(
    `Invalid transformation link: ${fromKind} → ${toKind}. ` +
      `Allowed sequence: ${TRANSFORMATION_CHAIN.join(' → ')}`,
  );
}

export function assertRelation(relation) {
  if (!CHAIN_RELATIONS.includes(relation)) {
    throw new Error(
      `Invalid relation "${relation}". Must be one of: ${CHAIN_RELATIONS.join(', ')}`,
    );
  }
}

/**
 * @param {object} input
 */
export function normalizeLink(input) {
  assertRelation(input.relation);
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Link id is required');
  const from = String(input.from ?? '').trim();
  const to = String(input.to ?? '').trim();
  if (!from || !to) throw new Error('Link from and to are required');
  if (from === to) throw new Error('Link cannot connect an entity to itself');

  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata
      : {};

  const created_at = input.created_at ?? new Date().toISOString();

  return {
    id,
    from,
    to,
    relation: input.relation,
    metadata,
    created_at,
  };
}

/** @typedef {{ id: string, from: string, to: string, relation: string, metadata: Record<string, unknown>, created_at: string }} SeedLink */
