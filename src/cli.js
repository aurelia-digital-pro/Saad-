#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { Vault } from './vault.js';
import { ContextEngine } from './context.js';
import { PatternEngine } from './pattern-engine.js';
import { OpportunityEngine } from './opportunity-engine.js';
import { exportVault, importVault } from './export-import.js';
import { LinkStore } from './link-store.js';
import { PatternStore } from './pattern-store.js';
import { OpportunityStore } from './opportunity-store.js';
import { TRANSFORMATION_KINDS } from './model.js';
import { startAssistantServer } from './assistant-server.js';
import { exec } from 'node:child_process';

function defaultVaultPath() {
  return process.env.SEED_VAULT_PATH
    ? path.resolve(process.env.SEED_VAULT_PATH)
    : path.resolve(process.cwd(), 'vault');
}

function usage() {
  const kinds = TRANSFORMATION_KINDS.join(' | ');
  console.log(`SEED — sovereign transformation system (offline-first, no external services)

PRODUCT (start here):
  seed start [--vault <path>] [--port <n>]   Open assistant in browser
  (or double-click START.bat on Windows)

Entities (Phase 1):
  seed init [--vault <path>]
  seed create <kind> [--title <text>] [--body <text>] [--vault <path>]
  seed get <id> [--vault <path>]
  seed list [--kind <kind>] [--vault <path>]
  seed export <file.seed-export.json> [--vault <path>]
  seed import <file.seed-export.json> [--vault <path>]

Context (Phase 2):
  seed link <from-id> <to-id>              Connect entities (Origin→…→Impact)
  seed links [--vault <path>]              List all links
  seed trace forward <id>                  Traverse toward impact
  seed trace backward <id>                 Traverse toward origin
  seed chain <id>                          Reconstruct full chain from any node
  seed graph [--vault <path>]              Relationship graph (stored data only)
  seed explain <id>                        Explainable context for one entity

Patterns (Phase 3):
  seed patterns discover [--min <n>]       Scan vault chains; store repeated patterns
  seed patterns list                       List stored patterns
  seed patterns get <id>                   Get pattern by id
  seed patterns explain <id>               Pattern explanation + sources
  seed patterns reconstruct <id>           Reconstruct one observed instance
  seed patterns index                      Pattern signature index

Opportunities (Phase 4):
  seed opportunities discover [--min <n>]  Detect evidence-backed opportunities
  seed opportunities list                  List opportunities (ranked)
  seed opportunities get <id>              Get opportunity by id
  seed opportunities explain <id>          Full trace to supporting pattern
  seed opportunities rank                  Ranked opportunity list

System:
  seed status [--vault <path>]             Stored vs computed counts (transparency)

Kinds: ${kinds}

Environment:
  SEED_VAULT_PATH   Default vault directory (else ./vault)

Storage (local, authoritative):
  vault/entities/  vault/links/  vault/patterns/  vault/opportunities/
Computed (derived, recomputable): patterns discover, opportunities discover
Online: not enabled (optional future layer; never required)
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (
      a === '--vault' ||
      a === '--title' ||
      a === '--kind' ||
      a === '--body' ||
      a === '--min' ||
      a === '--instance' ||
      a === '--port'
    ) {
      flags[a.slice(2)] = args[i + 1];
      i += 1;
    } else if (a.startsWith('--')) {
      flags[a.slice(2)] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function openVault(vaultPath) {
  const vault = new Vault(vaultPath);
  vault.open();
  return vault;
}

function openContext(vaultPath) {
  const vault = openVault(vaultPath);
  return new ContextEngine(vault);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];
  const vaultPath = flags.vault ? path.resolve(flags.vault) : defaultVaultPath();

  if (!cmd || cmd === 'help' || flags.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  try {
    if (cmd === 'start') {
      const port = flags.port ? Number(flags.port) : undefined;
      const { url, vaultPath: vp } = await startAssistantServer({ vaultPath, port });
      console.log(`\nWASSAD is running (offline, local-only)`);
      console.log(`Open: ${url}`);
      console.log(`Vault: ${vp}`);
      console.log(`Press Ctrl+C to stop.\n`);
      if (process.platform === 'win32') {
        exec(`start "" "${url}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${url}"`);
      }
      return;
    }

    if (cmd === 'init') {
      const vault = new Vault(vaultPath);
      vault.init();
      console.log(JSON.stringify({ ok: true, vault: vaultPath, mode: 'offline' }, null, 2));
      return;
    }

    if (cmd === 'create') {
      const kind = positional[1];
      if (!kind) throw new Error('create requires <kind>');
      const vault = openVault(vaultPath);
      const entity = vault.create({
        kind,
        title: flags.title ?? '',
        body: flags.body ?? '',
      });
      console.log(JSON.stringify(entity, null, 2));
      return;
    }

    if (cmd === 'get') {
      const id = positional[1];
      if (!id) throw new Error('get requires <id>');
      const vault = openVault(vaultPath);
      const entity = vault.get(id);
      if (!entity) {
        console.error(JSON.stringify({ ok: false, error: 'not_found', id }));
        process.exit(1);
      }
      console.log(JSON.stringify(entity, null, 2));
      return;
    }

    if (cmd === 'list') {
      const vault = openVault(vaultPath);
      const entities = vault.list(flags.kind ? { kind: flags.kind } : {});
      console.log(JSON.stringify(entities, null, 2));
      return;
    }

    if (cmd === 'export') {
      const out = positional[1];
      if (!out) throw new Error('export requires <file>');
      const vault = openVault(vaultPath);
      const result = exportVault(vault, path.resolve(out));
      console.log(JSON.stringify({ ok: true, ...result, mode: 'offline' }, null, 2));
      return;
    }

    if (cmd === 'import') {
      const input = positional[1];
      if (!input) throw new Error('import requires <file>');
      const vault = openVault(vaultPath);
      const result = importVault(vault, path.resolve(input));
      console.log(JSON.stringify({ ok: true, ...result, mode: 'offline' }, null, 2));
      return;
    }

    if (cmd === 'link') {
      const fromId = positional[1];
      const toId = positional[2];
      if (!fromId || !toId) throw new Error('link requires <from-id> <to-id>');
      const ctx = openContext(vaultPath);
      const link = ctx.connect(fromId, toId);
      console.log(JSON.stringify({ ok: true, link, stored: 'local:links/' }, null, 2));
      return;
    }

    if (cmd === 'links') {
      const ctx = openContext(vaultPath);
      console.log(JSON.stringify(ctx.links.list(), null, 2));
      return;
    }

    if (cmd === 'trace') {
      const direction = positional[1];
      const id = positional[2];
      if (!direction || !id) throw new Error('trace requires forward|backward <id>');
      const ctx = openContext(vaultPath);
      const result =
        direction === 'forward'
          ? ctx.traceForward(id)
          : direction === 'backward'
            ? ctx.traceBackward(id)
            : null;
      if (!result) throw new Error('trace direction must be forward or backward');
      console.log(
        JSON.stringify(
          {
            direction,
            entities: result.entities,
            links: result.links,
            computed: false,
            source: 'vault_links',
          },
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === 'chain') {
      const id = positional[1];
      if (!id) throw new Error('chain requires <id>');
      const ctx = openContext(vaultPath);
      const chain = ctx.reconstructChain(id);
      console.log(
        JSON.stringify(
          {
            ...chain,
            invariant: 'origin → decision → action → result → impact',
            computed: false,
            source: 'vault_links',
          },
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === 'graph') {
      const ctx = openContext(vaultPath);
      console.log(JSON.stringify(ctx.getGraph(), null, 2));
      return;
    }

    if (cmd === 'explain') {
      const id = positional[1];
      if (!id) throw new Error('explain requires <id>');
      const ctx = openContext(vaultPath);
      console.log(JSON.stringify(ctx.explain(id), null, 2));
      return;
    }

    if (cmd === 'patterns') {
      const sub = positional[1];
      const vault = openVault(vaultPath);
      const engine = new PatternEngine(vault);
      const min = flags.min ? Number(flags.min) : 2;

      if (sub === 'discover') {
        console.log(JSON.stringify(engine.discover({ minOccurrences: min }), null, 2));
        return;
      }
      if (sub === 'list') {
        console.log(JSON.stringify(engine.list(), null, 2));
        return;
      }
      if (sub === 'get') {
        const id = positional[2];
        const p = engine.get(id);
        if (!p) throw new Error(`Pattern not found: ${id}`);
        console.log(JSON.stringify(p, null, 2));
        return;
      }
      if (sub === 'explain') {
        console.log(JSON.stringify(engine.explain(positional[2]), null, 2));
        return;
      }
      if (sub === 'reconstruct') {
        const idx = flags.instance ? Number(flags.instance) : 0;
        console.log(JSON.stringify(engine.reconstruct(positional[2], idx), null, 2));
        return;
      }
      if (sub === 'index') {
        console.log(JSON.stringify(engine.getIndex(), null, 2));
        return;
      }
      throw new Error('patterns subcommand: discover|list|get|explain|reconstruct|index');
    }

    if (cmd === 'opportunities') {
      const sub = positional[1];
      const vault = openVault(vaultPath);
      const engine = new OpportunityEngine(vault);
      const min = flags.min ? Number(flags.min) : 2;

      if (sub === 'discover') {
        console.log(
          JSON.stringify(engine.discover({ minPatternOccurrences: min }), null, 2),
        );
        return;
      }
      if (sub === 'list') {
        console.log(JSON.stringify(engine.list(), null, 2));
        return;
      }
      if (sub === 'get') {
        const o = engine.get(positional[2]);
        if (!o) throw new Error(`Opportunity not found: ${positional[2]}`);
        console.log(JSON.stringify(o, null, 2));
        return;
      }
      if (sub === 'explain') {
        console.log(JSON.stringify(engine.explain(positional[2]), null, 2));
        return;
      }
      if (sub === 'rank') {
        console.log(JSON.stringify(engine.rank(), null, 2));
        return;
      }
      throw new Error('opportunities subcommand: discover|list|get|explain|rank');
    }

    if (cmd === 'status') {
      const vault = openVault(vaultPath);
      const links = new LinkStore(vault);
      links.ensureReady();
      const patterns = new PatternStore(vault);
      patterns.ensureReady();
      const opportunities = new OpportunityStore(vault);
      opportunities.ensureReady();
      console.log(
        JSON.stringify(
          {
            mode: 'offline',
            stored: {
              entities: vault.list().length,
              links: links.list().length,
              patterns: patterns.list().length,
              opportunities: opportunities.list().length,
            },
            computed_layers: {
              pattern_discovery: 'seed patterns discover',
              opportunity_detection: 'seed opportunities discover',
            },
            online_enabled: false,
            source_of_truth: 'vault/',
          },
          null,
          2,
        ),
      );
      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err.message ?? err) }, null, 2));
    process.exit(1);
  }
}

main();
