#!/usr/bin/env node
/**
 * Phase 1 validation gate — no external services.
 * Run: node scripts/validate-phase1.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vault } from '../src/vault.js';
import { exportVault, importVault } from '../src/export-import.js';
import { TRANSFORMATION_KINDS } from '../src/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

async function run() {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-phase1-'));
  const vaultPath = path.join(tmpBase, 'vault');
  const exportPath = path.join(tmpBase, 'bundle.seed-export.json');
  const reimportVaultPath = path.join(tmpBase, 'vault-restored');

  const results = [];

  try {
    section('1. Create vault');
    const vault = new Vault(vaultPath);
    vault.init();
    assert(vault.exists(), 'Vault manifest must exist');
    results.push('vault_initialized');

    section('2. Create transformation entities');
    const created = {};
    for (const kind of TRANSFORMATION_KINDS) {
      created[kind] = vault.create({
        kind,
        title: `Phase1 ${kind}`,
        body: `Test body for ${kind}`,
        metadata: { phase: 1, test: true },
      });
    }
    assert(
      Object.keys(created).length === TRANSFORMATION_KINDS.length,
      'All transformation kinds must be creatable',
    );
    results.push('entities_created');

    section('3. Persist and recover (simulate restart)');
    const vault2 = new Vault(vaultPath);
    vault2.open();
    for (const kind of TRANSFORMATION_KINDS) {
      const recovered = vault2.get(created[kind].id);
      assert(recovered !== null, `Must recover ${kind}`);
      assert(recovered.title === created[kind].title, `Title must match for ${kind}`);
    }
    assert(vault2.list().length === TRANSFORMATION_KINDS.length, 'List count after restart');
    results.push('data_survives_restart');

    section('4. Export (human-owned portable bundle)');
    exportVault(vault2, exportPath);
    assert(fs.existsSync(exportPath), 'Export file must exist');
    const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert(bundle.seed_export_format === '1', 'Export format version');
    assert(bundle.entities.length === TRANSFORMATION_KINDS.length, 'Export entity count');
    results.push('export_ok');

    section('5. Import into fresh vault');
    const vault3 = new Vault(reimportVaultPath);
    vault3.init();
    importVault(vault3, exportPath);
    for (const kind of TRANSFORMATION_KINDS) {
      const imported = vault3.get(created[kind].id);
      assert(imported !== null, `Imported ${kind} must exist`);
      assert(imported.body === created[kind].body, `Body must match for ${kind}`);
    }
    results.push('import_ok');

    section('6. Open format on disk');
    const entityFile = path.join(vaultPath, 'entities', `${created.origin.id}.json`);
    const rawEntity = fs.readFileSync(entityFile, 'utf8');
    assert(rawEntity.includes('"kind": "origin"'), 'Entity file is human-readable JSON');
    results.push('open_format_verified');

    section('VALIDATION GATE: PASSED');
    console.log(
      JSON.stringify(
        {
          status: 'PASSED',
          phase: 1,
          checks: results,
          external_services_required: false,
          vault_path: vaultPath,
          export_path: exportPath,
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
      /* ignore cleanup errors */
    }
  }
}

run();
