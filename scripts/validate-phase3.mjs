#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Vault } from '../src/vault.js';
import { ContextEngine } from '../src/context.js';
import { PatternEngine } from '../src/pattern-engine.js';
import { exportVault, importVault } from '../src/export-import.js';
import { TRANSFORMATION_CHAIN } from '../src/model.js';

function assert(c, m) {
  if (!c) throw new Error(m);
}

function buildChain(vault, ctx, titles) {
  const entities = [];
  for (let i = 0; i < titles.length; i += 1) {
    entities.push(
      vault.create({
        kind: TRANSFORMATION_CHAIN[i],
        title: titles[i],
        body: `body-${titles[i]}`,
      }),
    );
  }
  for (let i = 0; i < entities.length - 1; i += 1) {
    ctx.connect(entities[i].id, entities[i + 1].id);
  }
  return entities;
}

const titles = ['Origin A', 'Decision B', 'Action C', 'Result D', 'Impact E'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-p3-'));
const vaultPath = path.join(tmp, 'vault');

try {
  const vault = new Vault(vaultPath);
  vault.init();
  const ctx = new ContextEngine(vault);
  buildChain(vault, ctx, titles);
  buildChain(vault, ctx, titles);

  const engine = new PatternEngine(vault);
  const result = engine.discover();
  assert(result.discovered >= 1, 'Must discover at least one pattern');
  assert(result.computed === true, 'Must declare computed');

  const patterns = engine.list();
  const p = patterns[0];
  assert(p.occurrence_count === 2, 'Pattern must occur twice');
  assert(p.source_entity_ids.length >= 5, 'Must reference source entities');
  assert(p.source_link_ids.length >= 4, 'Must reference source links');
  assert(p.confidence_formula.includes('occurrence_count'), 'Must document formula');
  assert(p.explanation.length > 20, 'Must explain pattern');

  const explained = engine.explain(p.id);
  assert(explained.source_entity_ids.length > 0, 'Explain must expose sources');
  assert(explained.computed === true, 'Explain is computed');

  const reconstructed = engine.reconstruct(p.id, 0);
  assert(reconstructed.entities.length === 5, 'Reconstruct path');
  assert(reconstructed.computed === false, 'Reconstruct reads vault');

  const index = engine.getIndex();
  assert(Object.keys(index.by_signature).length >= 1, 'Index must exist');

  const exportPath = path.join(tmp, 'out.seed-export.json');
  exportVault(vault, exportPath);
  const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert(bundle.patterns.length >= 1, 'Export includes patterns');

  const vault2Path = path.join(tmp, 'vault2');
  const vault2 = new Vault(vault2Path);
  vault2.init();
  importVault(vault2, exportPath);
  const engine2 = new PatternEngine(vault2);
  assert(engine2.list().length >= 1, 'Import preserves patterns');

  console.log(
    JSON.stringify(
      {
        status: 'PASSED',
        phase: 3,
        checks: [
          'pattern_discovery',
          'occurrence_and_confidence',
          'source_traceability',
          'reconstruction',
          'index',
          'export_import',
        ],
        external_services_required: false,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(JSON.stringify({ status: 'FAILED', error: String(e.message ?? e) }, null, 2));
  process.exit(1);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
