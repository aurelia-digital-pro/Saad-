import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizePattern, PATTERN_FORMAT } from './pattern-model.js';
import { assertSafeId } from './link-store.js';

const PATTERNS_DIR = 'patterns';
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

export function deterministicIdFromSignature(prefix, signature) {
  const h = crypto.createHash('sha256').update(`${prefix}:${signature}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export class PatternStore {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.patternsPath = path.join(vault.rootPath, PATTERNS_DIR);
    this.indexPath = path.join(this.patternsPath, INDEX_FILE);
  }

  ensureReady() {
    fs.mkdirSync(this.patternsPath, { recursive: true });
  }

  #patternPath(id) {
    assertSafeId(id, 'pattern id');
    return path.join(this.patternsPath, `${id}.json`);
  }

  readIndex() {
    this.ensureReady();
    if (!fs.existsSync(this.indexPath)) {
      return { pattern_format: PATTERN_FORMAT, by_signature: {}, updated_at: null };
    }
    return readJson(this.indexPath);
  }

  writeIndex(bySignature) {
    writeJsonAtomic(this.indexPath, {
      pattern_format: PATTERN_FORMAT,
      by_signature: bySignature,
      updated_at: new Date().toISOString(),
      computed: true,
      source: 'pattern_store',
    });
  }

  /** Replace all patterns (deterministic full rebuild). */
  replaceAll(patterns) {
    this.ensureReady();
    const existing = fs.existsSync(this.patternsPath)
      ? fs.readdirSync(this.patternsPath).filter((f) => f.endsWith('.json') && f !== INDEX_FILE)
      : [];
    for (const file of existing) {
      fs.unlinkSync(path.join(this.patternsPath, file));
    }

    const bySignature = {};
    for (const pattern of patterns) {
      const normalized = normalizePattern(pattern);
      writeJsonAtomic(this.#patternPath(normalized.id), normalized);
      bySignature[normalized.signature] = normalized.id;
    }
    this.writeIndex(bySignature);
    this.vault.touchManifest();
    return patterns.length;
  }

  list() {
    this.ensureReady();
    const files = fs.readdirSync(this.patternsPath).filter((f) => f.endsWith('.json') && f !== INDEX_FILE);
    return files
      .map((f) => normalizePattern(readJson(path.join(this.patternsPath, f))))
      .sort((a, b) => b.occurrence_count - a.occurrence_count || a.signature.localeCompare(b.signature));
  }

  get(id) {
    const filePath = this.#patternPath(id);
    if (!fs.existsSync(filePath)) return null;
    return normalizePattern(readJson(filePath));
  }

  getBySignature(signature) {
    const index = this.readIndex();
    const id = index.by_signature[signature];
    return id ? this.get(id) : null;
  }

  put(pattern) {
    const normalized = normalizePattern(pattern);
    this.ensureReady();
    writeJsonAtomic(this.#patternPath(normalized.id), normalized);
    const index = this.readIndex();
    index.by_signature[normalized.signature] = normalized.id;
    this.writeIndex(index.by_signature);
    this.vault.touchManifest();
    return normalized;
  }
}
