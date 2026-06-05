# SEED Vault Format (v1)

Human-owned, open, portable storage for the transformation model.

## Layout

```
<vault-root>/
  manifest.json          # vault metadata and schema version
  entities/
    <uuid>.json          # one file per entity
  links/
    <uuid>.json          # one file per transformation link (Phase 2+)
  patterns/
    _index.json          # signature → pattern id index (computed, stored)
    <uuid>.json          # one file per detected pattern (Phase 3+)
  opportunities/
    _index.json          # prefix key → opportunity id index (computed, stored)
    <uuid>.json          # one file per opportunity (Phase 4+)
```

## manifest.json

```json
{
  "seed_vault_format": "1",
  "created_at": "ISO-8601 UTC",
  "updated_at": "ISO-8601 UTC"
}
```

## Entity file (entities/<id>.json)

```json
{
  "id": "uuid",
  "kind": "origin | decision | action | result | impact",
  "title": "string",
  "body": "string",
  "metadata": {},
  "created_at": "ISO-8601 UTC",
  "updated_at": "ISO-8601 UTC"
}
```

## Link file (links/<id>.json)

```json
{
  "id": "uuid",
  "from": "entity-uuid",
  "to": "entity-uuid",
  "relation": "origin_to_decision | decision_to_action | action_to_result | result_to_impact",
  "metadata": {},
  "created_at": "ISO-8601 UTC"
}
```

Links must follow the transformation sequence. Invalid kind pairs are rejected.

## Export bundle (.seed-export.json)

```json
{
  "seed_export_format": "1",
  "exported_at": "ISO-8601 UTC",
  "manifest": { ... },
  "entities": [ ... ],
  "links": [ ... ],
  "patterns": [ ... ],
  "opportunities": [ ... ]
}
```

Import merges by `id` (same id overwrites). Bundles without `links`, `patterns`, or `opportunities` remain valid (backward compatible). No external services required.

## Pattern file (patterns/<id>.json)

Computed from stored entities and links via `seed patterns discover`. Contains `occurrence_count`, `recurrence_frequency`, `confidence_score` (formula: `occurrence_count / total_chains_scanned`), `instances[]` with `entity_ids` and `link_ids`, and `explanation`.

## Opportunity file (opportunities/<id>.json)

Computed from stored patterns via `seed opportunities discover`. References `pattern_id`, `prefix_entity_ids`, `missing_steps`, `supporting_chains`, and documented `confidence_formula`. No opportunity exists without a supporting pattern.
