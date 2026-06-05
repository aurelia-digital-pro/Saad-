/**
 * SEED transformation model — central invariant:
 * Origin → Decision → Action → Result → Impact
 */

export const TRANSFORMATION_KINDS = Object.freeze([
  'origin',
  'decision',
  'action',
  'result',
  'impact',
]);

export const TRANSFORMATION_CHAIN = Object.freeze([
  'origin',
  'decision',
  'action',
  'result',
  'impact',
]);

export function isTransformationKind(kind) {
  return TRANSFORMATION_KINDS.includes(kind);
}

export function assertTransformationKind(kind) {
  if (!isTransformationKind(kind)) {
    throw new Error(
      `Invalid entity kind "${kind}". Must be one of: ${TRANSFORMATION_KINDS.join(', ')}`,
    );
  }
}

/**
 * @param {object} input
 * @returns {import('./model.js').SeedEntity}
 */
export function normalizeEntity(input) {
  assertTransformationKind(input.kind);
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Entity id is required');

  const title = String(input.title ?? '').trim();
  const body = String(input.body ?? '');
  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata
      : {};

  const created_at = input.created_at ?? new Date().toISOString();
  const updated_at = input.updated_at ?? created_at;

  return {
    id,
    kind: input.kind,
    title,
    body,
    metadata,
    created_at,
    updated_at,
  };
}

/** @typedef {{ id: string, kind: string, title: string, body: string, metadata: Record<string, unknown>, created_at: string, updated_at: string }} SeedEntity */
