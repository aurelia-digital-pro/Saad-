import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertTransformationKind, normalizeEntity } from './model.js';

const MANIFEST_FILE = 'manifest.json';
const ENTITIES_DIR = 'entities';
const LINKS_DIR = 'links';
const PATTERNS_DIR = 'patterns';
const OPPORTUNITIES_DIR = 'opportunities';
const VAULT_FORMAT = '1';

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Local-first vault: one JSON file per entity under a human-readable directory.
 */
export class Vault {
  /** @param {string} rootPath */
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
    this.entitiesPath = path.join(this.rootPath, ENTITIES_DIR);
    this.manifestPath = path.join(this.rootPath, MANIFEST_FILE);
  }

  exists() {
    return fs.existsSync(this.manifestPath);
  }

  init() {
    if (this.exists()) {
      throw new Error(`Vault already exists at ${this.rootPath}`);
    }
    fs.mkdirSync(this.entitiesPath, { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, LINKS_DIR), { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, PATTERNS_DIR), { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, OPPORTUNITIES_DIR), { recursive: true });
    const ts = nowIso();
    writeJsonAtomic(this.manifestPath, {
      seed_vault_format: VAULT_FORMAT,
      created_at: ts,
      updated_at: ts,
    });
  }

  open() {
    if (!this.exists()) {
      throw new Error(`Vault not found at ${this.rootPath}. Run: seed init`);
    }
    fs.mkdirSync(this.entitiesPath, { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, LINKS_DIR), { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, PATTERNS_DIR), { recursive: true });
    fs.mkdirSync(path.join(this.rootPath, OPPORTUNITIES_DIR), { recursive: true });
  }

  touchManifest() {
    const manifest = readJson(this.manifestPath);
    manifest.updated_at = nowIso();
    writeJsonAtomic(this.manifestPath, manifest);
  }

  #entityPath(id) {
    return path.join(this.entitiesPath, `${id}.json`);
  }

  /**
   * @param {{ kind: string, title?: string, body?: string, metadata?: Record<string, unknown>, id?: string }} fields
   */
  create(fields) {
    assertTransformationKind(fields.kind);
    const id = fields.id ?? crypto.randomUUID();
    const ts = nowIso();
    const entity = normalizeEntity({
      id,
      kind: fields.kind,
      title: fields.title ?? '',
      body: fields.body ?? '',
      metadata: fields.metadata ?? {},
      created_at: ts,
      updated_at: ts,
    });
    writeJsonAtomic(this.#entityPath(entity.id), entity);
    this.touchManifest();
    return entity;
  }

  /** @param {string} id */
  get(id) {
    const filePath = this.#entityPath(id);
    if (!fs.existsSync(filePath)) return null;
    return normalizeEntity(readJson(filePath));
  }

  /** @param {{ kind?: string }} [filter] */
  list(filter = {}) {
    if (!fs.existsSync(this.entitiesPath)) return [];
    const files = fs.readdirSync(this.entitiesPath).filter((f) => f.endsWith('.json'));
    const entities = files.map((f) => normalizeEntity(readJson(path.join(this.entitiesPath, f))));
    if (filter.kind) {
      assertTransformationKind(filter.kind);
      return entities.filter((e) => e.kind === filter.kind);
    }
    return entities.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /**
   * Write a full entity (used by import). Preserves id, kind, and timestamps.
   * @param {import('./model.js').SeedEntity} entity
   */
  put(entity) {
    const normalized = normalizeEntity(entity);
    writeJsonAtomic(this.#entityPath(normalized.id), normalized);
    this.touchManifest();
    return normalized;
  }

  /** @param {string} id @param {{ title?: string, body?: string, metadata?: Record<string, unknown> }} patch */
  update(id, patch) {
    const existing = this.get(id);
    if (!existing) throw new Error(`Entity not found: ${id}`);
    const updated = normalizeEntity({
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      body: patch.body !== undefined ? patch.body : existing.body,
      metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      updated_at: nowIso(),
    });
    writeJsonAtomic(this.#entityPath(id), updated);
    this.touchManifest();
    return updated;
  }

  getManifest() {
    return readJson(this.manifestPath);
  }
}
