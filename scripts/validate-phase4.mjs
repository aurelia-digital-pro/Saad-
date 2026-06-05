#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Vault } from '../src/vault.js';
import { ContextEngine } from '../src/context.js';
import { OpportunityEngine } from '../src/opportunity-engine.js';
import { exportVault, importVault } from '../src/export-import.js';
import { TRANSFORMATION_CHAIN } from '../src/model.js';

function assert(c, m) {
  if (!c) throw new Error(m);
}

function buildPartialChain(vault, ctx, titles) {
  const entities = [];
  for (let i = 0; i < titles.length; i += 1) {
    entities.push(
      vault.create({
        kind: TRANSFORMATION_CHAIN[i],
        title: titles[i],
        body: '',
      }),
    );
  }
  for (let i = 0; i < entities.length - 1; i += 1) {
    ctx.connect(entities[i].id, entities[i + 1].id);
  }
  return entities;
}

const fullTitles = ['Origin A', 'Decision B', 'Action C', 'Result D', 'Impact E'];
const prefixTitles = ['Origin A', 'Decision B', 'Action C'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-p4-'));
const vaultPath = path.join(tmp, 'vault');

try {
  const vault = new Vault(vaultPath);
  vault.init();
  const ctx = new ContextEngine(vault);

  for (let i = 0; i < 3; i += 1) {
    buildPartialChain(vault, ctx, fullTitles);
  }
  buildPartialChain(vault, ctx, prefixTitles);

  const engine = new OpportunityEngine(vault);
  const result = engine.discover({ minPatternOccurrences: 2 });
  assert(result.discovered >= 1, 'Must detect at least one opportunity');
  assert(result.computed === true, 'Must declare computed');

  const opps = engine.list();
  const opp = opps[0];
  assert(opp.pattern_id, 'Must reference pattern');
  assert(opp.supporting_pattern_occurrences >= 2, 'Must have historical support');
  assert(opp.missing_steps.length >= 1, 'Must specify missing steps');
  assert(opp.reasoning_path.length >= 2, 'Must include reasoning path');

  const explained = engine.explain(opp.id);
  assert(explained.originating_pattern.id === opp.pattern_id, 'Pattern traceability');
  assert(explained.supporting_chains.length >= 2, 'Supporting chains from pattern');
  assert(explained.computed === true, 'Explain is computed');

  const ranked = engine.rank();
  assert(ranked[0].rank === 1, 'Ranking works');

  const exportPath = path.join(tmp, 'out.seed-export.json');
  exportVault(vault, exportPath);
  const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert(bundle.opportunities.length >= 1, 'Export includes opportunities');

  const vault2Path = path.join(tmp, 'vault2');
  const vault2 = new Vault(vault2Path);
  vault2.init();
  importVault(vault2, exportPath);
  const engine2 = new OpportunityEngine(vault2);
  assert(engine2.list().length >= 1, 'Import preserves opportunities');

  const emptyVaultPath = path.join(tmp, 'empty');
  const emptyVault = new Vault(emptyVaultPath);
  emptyVault.init();
  const emptyEngine = new OpportunityEngine(emptyVault);
  const emptyResult = emptyEngine.discover();
  assert(emptyResult.discovered === 0, 'No fabricated opportunities on empty vault');

  console.log(
    JSON.stringify(
      {
        status: 'PASSED',
        phase: 4,
        checks: [
          'opportunity_detection',
          'pattern_support_required',
          'traceability',
          'ranking',
          'export_import',
          'no_empty_hallucination',
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
