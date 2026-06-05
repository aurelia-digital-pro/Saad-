import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeLink, relationForKinds } from './links-model.js';

const LINKS_DIR = 'links';

function nowIso() {
  return new Date().toISOString();
}

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

export function assertSafeId(id, label = 'id') {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`Invalid ${label}: must be a UUID`);
  }
}

/**
 * Local persistence for transformation links (stored under vault/links/).
 */
export class LinkStore {
  /** @param {import('./vault.js').Vault} vault */
  constructor(vault) {
    this.vault = vault;
    this.linksPath = path.join(vault.rootPath, LINKS_DIR);
  }

  ensureReady() {
    fs.mkdirSync(this.linksPath, { recursive: true });
  }

  #linkPath(id) {
    assertSafeId(id, 'link id');
    return path.join(this.linksPath, `${id}.json`);
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   */
  create(fromId, toId) {
    assertSafeId(fromId, 'from id');
    assertSafeId(toId, 'to id');
    this.ensureReady();

    const fromEntity = this.vault.get(fromId);
    const toEntity = this.vault.get(toId);
    if (!fromEntity) throw new Error(`Entity not found: ${fromId}`);
    if (!toEntity) throw new Error(`Entity not found: ${toId}`);

    const relation = relationForKinds(fromEntity.kind, toEntity.kind);
    const id = crypto.randomUUID();
    const link = normalizeLink({
      id,
      from: fromId,
      to: toId,
      relation,
      created_at: nowIso(),
    });

    writeJsonAtomic(this.#linkPath(id), link);
    this.vault.touchManifest();
    return link;
  }

  /** @param {string} id */
  get(id) {
    const filePath = this.#linkPath(id);
    if (!fs.existsSync(filePath)) return null;
    return normalizeLink(readJson(filePath));
  }

  list() {
    this.ensureReady();
    if (!fs.existsSync(this.linksPath)) return [];
    const files = fs.readdirSync(this.linksPath).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => normalizeLink(readJson(path.join(this.linksPath, f))))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /** @param {import('./links-model.js').SeedLink} link */
  put(link) {
    const normalized = normalizeLink(link);
    assertSafeId(normalized.from, 'from id');
    assertSafeId(normalized.to, 'to id');
    const fromEntity = this.vault.get(normalized.from);
    const toEntity = this.vault.get(normalized.to);
    if (!fromEntity) throw new Error(`Entity not found: ${normalized.from}`);
    if (!toEntity) throw new Error(`Entity not found: ${normalized.to}`);
    relationForKinds(fromEntity.kind, toEntity.kind);
    this.ensureReady();
    writeJsonAtomic(this.#linkPath(normalized.id), normalized);
    this.vault.touchManifest();
    return normalized;
  }

  /** @param {string} entityId */
  incoming(entityId) {
    return this.list().filter((l) => l.to === entityId);
  }

  /** @param {string} entityId */
  outgoing(entityId) {
    return this.list().filter((l) => l.from === entityId);
  }
}
