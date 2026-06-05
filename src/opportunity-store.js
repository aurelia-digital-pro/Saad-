import fs from 'node:fs';
import path from 'node:path';
import { normalizeOpportunity, OPPORTUNITY_FORMAT } from './opportunity-model.js';
import { assertSafeId } from './link-store.js';
import { deterministicIdFromSignature } from './pattern-store.js';

const OPPORTUNITIES_DIR = 'opportunities';
const INDEX_FILE = '_index.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

export class OpportunityStore {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.opportunitiesPath = path.join(vault.rootPath, OPPORTUNITIES_DIR);
    this.indexPath = path.join(this.opportunitiesPath, INDEX_FILE);
  }

  ensureReady() {
    fs.mkdirSync(this.opportunitiesPath, { recursive: true });
  }

  #opportunityPath(id) {
    assertSafeId(id, 'opportunity id');
    return path.join(this.opportunitiesPath, `${id}.json`);
  }

  readIndex() {
    this.ensureReady();
    if (!fs.existsSync(this.indexPath)) {
      return { opportunity_format: OPPORTUNITY_FORMAT, by_prefix: {}, updated_at: null };
    }
    return readJson(this.indexPath);
  }

  writeIndex(byPrefix) {
    writeJsonAtomic(this.indexPath, {
      opportunity_format: OPPORTUNITY_FORMAT,
      by_prefix: byPrefix,
      updated_at: new Date().toISOString(),
      computed: true,
      source: 'opportunity_store',
    });
  }

  replaceAll(opportunities) {
    this.ensureReady();
    const existing = fs.existsSync(this.opportunitiesPath)
      ? fs
          .readdirSync(this.opportunitiesPath)
          .filter((f) => f.endsWith('.json') && f !== INDEX_FILE)
      : [];
    for (const file of existing) {
      fs.unlinkSync(path.join(this.opportunitiesPath, file));
    }

    const byPrefix = {};
    for (const opp of opportunities) {
      const normalized = normalizeOpportunity(opp);
      writeJsonAtomic(this.#opportunityPath(normalized.id), normalized);
      const prefixKey = normalized.prefix_entity_ids.join('>');
      byPrefix[prefixKey] = normalized.id;
    }
    this.writeIndex(byPrefix);
    this.vault.touchManifest();
    return opportunities.length;
  }

  list() {
    this.ensureReady();
    const files = fs
      .readdirSync(this.opportunitiesPath)
      .filter((f) => f.endsWith('.json') && f !== INDEX_FILE);
    return files
      .map((f) => normalizeOpportunity(readJson(path.join(this.opportunitiesPath, f))))
      .sort(
        (a, b) =>
          b.confidence_score - a.confidence_score ||
          b.supporting_pattern_occurrences - a.supporting_pattern_occurrences,
      );
  }

  get(id) {
    const filePath = this.#opportunityPath(id);
    if (!fs.existsSync(filePath)) return null;
    return normalizeOpportunity(readJson(filePath));
  }

  put(opportunity) {
    const normalized = normalizeOpportunity(opportunity);
    this.ensureReady();
    writeJsonAtomic(this.#opportunityPath(normalized.id), normalized);
    const index = this.readIndex();
    const prefixKey = normalized.prefix_entity_ids.join('>');
    index.by_prefix[prefixKey] = normalized.id;
    this.writeIndex(index.by_prefix);
    this.vault.touchManifest();
    return normalized;
  }
}

export function opportunityIdFrom(prefixEntityIds, patternId) {
  const key = `${patternId}|${prefixEntityIds.join('>')}`;
  return deterministicIdFromSignature('opportunity', key);
}
