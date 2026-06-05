#!/usr/bin/env node
/**
 * Phase 2 validation gate — Context Engine
 * Run: node scripts/validate-phase2.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vault } from '../src/vault.js';
import { ContextEngine } from '../src/context.js';
import { exportVault, importVault } from '../src/export-import.js';
import { TRANSFORMATION_CHAIN } from '../src/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function buildFullChain(vault, ctx) {
  const entities = {};
  for (const kind of TRANSFORMATION_CHAIN) {
    entities[kind] = vault.create({
      kind,
      title: `Chain ${kind}`,
      body: `Body for ${kind}`,
    });
  }
  for (let i = 0; i < TRANSFORMATION_CHAIN.length - 1; i += 1) {
    const fromKind = TRANSFORMATION_CHAIN[i];
    const toKind = TRANSFORMATION_CHAIN[i + 1];
    ctx.connect(entities[fromKind].id, entities[toKind].id);
  }
  return entities;
}

async function run() {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-phase2-'));
  const vaultPath = path.join(tmpBase, 'vault');
  const exportPath = path.join(tmpBase, 'bundle.seed-export.json');
  const importVaultPath = path.join(tmpBase, 'vault-imported');

  const results = [];

  try {
    section('1. Build transformation chain');
    const vault = new Vault(vaultPath);
    vault.init();
    const ctx = new ContextEngine(vault);
    const chain = buildFullChain(vault, ctx);
    results.push('chain_built');

    section('2. Forward traversal (origin → impact)');
    const forward = ctx.traceForward(chain.origin.id);
    assert(forward.entities.length === 5, 'Forward must reach 5 entities');
    assert(forward.entities[0].kind === 'origin', 'Forward starts at origin');
    assert(forward.entities[4].kind === 'impact', 'Forward ends at impact');
    results.push('forward_traversal');

    section('3. Backward traversal (impact → origin)');
    const backward = ctx.traceBackward(chain.impact.id);
    assert(backward.entities.length === 5, 'Backward must reach 5 entities');
    assert(backward.entities[0].kind === 'origin', 'Backward ends at origin');
    assert(backward.entities[4].kind === 'impact', 'Backward starts at impact');
    results.push('backward_traversal');

    section('4. Reconstruct from middle node (action)');
    const reconstructed = ctx.reconstructChain(chain.action.id);
    assert(reconstructed.entities.length === 5, 'Reconstruct from action');
    assert(reconstructed.complete === true, 'Chain must be complete');
    assert(reconstructed.origin.id === chain.origin.id, 'Origin id matches');
    assert(reconstructed.impact.id === chain.impact.id, 'Impact id matches');
    results.push('chain_reconstruction');

    section('5. Relationship graph');
    const graph = ctx.getGraph();
    assert(graph.nodes.length === 5, 'Graph has 5 nodes');
    assert(graph.edges.length === 4, 'Graph has 4 edges');
    assert(graph.stored.local_only === true, 'Graph is local-only');
    results.push('relationship_graph');

    section('6. Export/import includes links');
    exportVault(vault, exportPath);
    const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert(bundle.links.length === 4, 'Export contains links');

    const vault2 = new Vault(importVaultPath);
    vault2.init();
    importVault(vault2, exportPath);
    const ctx2 = new ContextEngine(vault2);
    const re = ctx2.reconstructChain(chain.decision.id);
    assert(re.entities.length === 5, 'Imported vault preserves chain');
    results.push('export_import_links');

    section('7. Phase 1 compatibility — entity-only export still valid');
    const legacyBundle = {
      seed_export_format: '1',
      exported_at: new Date().toISOString(),
      manifest: vault2.getManifest(),
      entities: [vault2.get(chain.origin.id)],
    };
    const legacyPath = path.join(tmpBase, 'legacy.seed-export.json');
    fs.writeFileSync(legacyPath, JSON.stringify(legacyBundle, null, 2));
    const vault3Path = path.join(tmpBase, 'vault-legacy');
    const vault3 = new Vault(vault3Path);
    vault3.init();
    importVault(vault3, legacyPath);
    assert(vault3.get(chain.origin.id) !== null, 'Legacy import works');
    results.push('phase1_compat');

    section('VALIDATION GATE: PASSED');
    console.log(
      JSON.stringify(
        {
          status: 'PASSED',
          phase: 2,
          checks: results,
          external_services_required: false,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  } catch (err) {
    section('VALIDATION GATE: FAILED');
    console.error(JSON.stringify({ status: 'FAILED', error: String(err.message ?? err) }, null, 2));
    process.exit(1);
  } finally {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

run();
