/**
 * Project grouping via entity.metadata.project (no schema change).
 */

export function projectNameFromEntity(entity) {
  const p = entity.metadata?.project;
  if (typeof p === 'string' && p.trim()) return p.trim();
  return 'Unassigned';
}

/**
 * @param {import('../vault.js').Vault} vault
 */
export function listProjects(vault) {
  const map = new Map();
  for (const entity of vault.list()) {
    const name = projectNameFromEntity(entity);
    const row = map.get(name) ?? { name, entity_ids: [], kinds: {} };
    row.entity_ids.push(entity.id);
    row.kinds[entity.kind] = (row.kinds[entity.kind] ?? 0) + 1;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {import('./system.js').SeedSystem} system
 */
export function projectSummaries(system) {
  const projects = listProjects(system.vault);
  const analyzer = system.analyzer;
  const stalled = analyzer.stalledItems();
  const incomplete = analyzer.incompleteChains();

  return projects.map((p) => {
    const stalledInProject = stalled.filter((s) => {
      const e = system.vault.get(s.id);
      return e && projectNameFromEntity(e) === p.name;
    });
    const incompleteInProject = incomplete.filter((c) =>
      c.chain_entity_ids.some((id) => {
        const e = system.vault.get(id);
        return e && projectNameFromEntity(e) === p.name;
      }),
    );

    const chainLength = TRANSFORMATION_DEPTH(p.kinds);
    const progress = Math.round((chainLength / 5) * 100);

    return {
      name: p.name,
      entity_count: p.entity_ids.length,
      kinds: p.kinds,
      stalled_count: stalledInProject.length,
      incomplete_chain_count: incompleteInProject.length,
      progress_percent: progress,
      evidence: { entity_ids: p.entity_ids },
    };
  });
}

function TRANSFORMATION_DEPTH(kinds) {
  const order = ['origin', 'decision', 'action', 'result', 'impact'];
  let max = 0;
  for (const k of order) {
    if (kinds[k]) max = order.indexOf(k) + 1;
  }
  return max;
}
