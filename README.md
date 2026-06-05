# SEED

Sovereign transformation system. **Offline-first** by default. No external services required.

## Use WASSAD (non-developer)

1. Install [Node.js](https://nodejs.org/) 18+ if needed.
2. **Double-click `START.bat`** (Windows) or run:

```bash
node src/cli.js start
```

3. Your browser opens **WASSAD** — Arabic/English, dashboard, projects, chat, add memory, backup.
4. Assign everything to a **project name** when adding (stored in your vault — you own the files).

**Backup / ownership:** click **Backup now** in the UI, or export via CLI. File is portable JSON you keep anywhere.

No JSON editing. No developer workflow for daily use.

**Phase 1:** Vault, entities, export/import.  
**Phase 2:** Context Engine — traceable chains (Origin → … → Impact).  
**Phase 3:** Pattern Engine — deterministic repetition detection.  
**Phase 4:** Opportunity Engine — evidence-backed completion hints.

## Central invariant

**Origin → Decision → Action → Result → Impact**

## Requirements

- [Node.js](https://nodejs.org/) 18+ (stdlib only; no `npm install` required for core)

## Quick start

```bash
cd path/to/seed
node src/cli.js init
node src/cli.js create origin --title "Initial question"
node src/cli.js list
node src/cli.js export ./my-vault.seed-export.json
```

Optional: `npm link` to expose the `seed` command globally.

## Phase 2 example (full chain)

```bash
node src/cli.js init
node src/cli.js create origin --title "Problem observed"
node src/cli.js create decision --title "Chosen approach"
# ... create action, result, impact, then:
node src/cli.js link <origin-id> <decision-id>
node src/cli.js link <decision-id> <action-id>
# ... link through to impact
node src/cli.js chain <any-id-in-chain>
node src/cli.js trace backward <impact-id>
```

## Patterns & opportunities

```bash
node src/cli.js patterns discover
node src/cli.js patterns list
node src/cli.js opportunities discover
node src/cli.js opportunities rank
node src/cli.js status
```

## Validation

```bash
node scripts/validate-phase1.mjs
node scripts/validate-phase2.mjs
node scripts/validate-phase3.mjs
node scripts/validate-phase4.mjs
node scripts/validate-assistant.mjs
```

## Vault location

Default: `./vault` in the current working directory. Override with `SEED_VAULT_PATH`.

## Open format

See [docs/VAULT-FORMAT.md](docs/VAULT-FORMAT.md).

## Principles (Phase 1)

| Principle | How Phase 1 honors it |
|-----------|------------------------|
| Offline / local first | All data under your vault directory |
| Human owned | Plain JSON files you can copy, edit, back up |
| Open format | Documented JSON layout + export bundle |
| Portable | Export/import round-trip |
| No vendor lock-in | No cloud, no SaaS, no AI in core |
| Deterministic core | Same files → same reads; no opaque inference |
