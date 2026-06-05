#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SeedSystem } from './assistant/system.js';
import { respondToMessage } from './assistant/responder.js';
import { projectSummaries } from './assistant/projects.js';
import { exportVault } from './export-import.js';
import { langFromRequest } from './assistant/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DEFAULT_PORT = 3847;

function defaultVaultPath() {
  return process.env.SEED_VAULT_PATH
    ? path.resolve(process.env.SEED_VAULT_PATH)
    : path.resolve(process.cwd(), 'vault');
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(`${JSON.stringify(data, null, 2)}\n`);
}

function serveStatic(res, urlPath) {
  const safe = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safe));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  res.end(fs.readFileSync(filePath));
}

/**
 * @param {{ vaultPath?: string, port?: number, host?: string }} [options]
 */
export function startAssistantServer(options = {}) {
  const vaultPath = options.vaultPath ?? defaultVaultPath();
  const port = options.port ?? Number(process.env.SEED_PORT ?? DEFAULT_PORT);
  const host = options.host ?? '127.0.0.1';
  const system = new SeedSystem(vaultPath);

  system.refresh();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${host}`);

    try {
      if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        return sendJson(res, 200, system.getStatus());
      }

      if (req.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(res, 200, {
          projects: projectSummaries(system),
          computed: true,
          source: 'vault_metadata_project',
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/refresh') {
        const result = system.refresh();
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && url.pathname === '/api/ask') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const lang = langFromRequest(body, req.headers);
        const answer = respondToMessage(system, body.message ?? '', lang);
        return sendJson(res, 200, answer);
      }

      if (req.method === 'POST' && url.pathname === '/api/entity') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const kind = body.kind;
        if (!kind) throw new Error('kind is required');
        const metadata = { ...(body.metadata ?? {}) };
        if (body.project) metadata.project = String(body.project).trim();

        const entity = system.vault.create({
          kind,
          title: body.title ?? '',
          body: body.body ?? '',
          metadata,
        });

        let link = null;
        if (body.link_from_id) {
          link = system.context.connect(body.link_from_id, entity.id);
        }

        system.refresh();
        return sendJson(res, 200, {
          ok: true,
          entity,
          link,
          stored: 'local:entities/',
          computed_refresh: true,
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/link') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const link = system.context.connect(body.from, body.to);
        system.refresh();
        return sendJson(res, 200, { ok: true, link });
      }

      if (req.method === 'GET' && url.pathname === '/api/backup') {
        const tmp = path.join(os.tmpdir(), `wassad-backup-${Date.now()}.seed-export.json`);
        exportVault(system.vault, tmp);
        const data = fs.readFileSync(tmp);
        fs.unlinkSync(tmp);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="wassad-backup.seed-export.json"',
        });
        res.end(data);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/guidance') {
        const analyzer = system.analyzer;
        return sendJson(res, 200, {
          focus_now: analyzer.dailyBrief().priorities.slice(0, 8),
          stalled: analyzer.stalledItems().slice(0, 10),
          incomplete_chains: analyzer.incompleteChains().slice(0, 10),
          opportunities: system.opportunities.list().slice(0, 10),
          patterns: analyzer.recurringSuccesses().slice(0, 10),
          gaps: analyzer.suspiciousGaps().slice(0, 10),
          projects: projectSummaries(system).slice(0, 12),
          computed: true,
          source: 'vault',
        });
      }

      if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'unknown_api' });
      }

      if (req.method === 'GET') {
        return serveStatic(res, url.pathname);
      }

      res.writeHead(405);
      res.end('Method not allowed');
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err.message ?? err) });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        server,
        url: `http://${host}:${actualPort}`,
        vaultPath,
        system,
      });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.SEED_PORT ?? DEFAULT_PORT);
  startAssistantServer({ port }).then(({ url, vaultPath }) => {
    console.log(`WASSAD running (offline, local-only)`);
    console.log(`Open in browser: ${url}`);
    console.log(`Vault: ${vaultPath}`);
  });
}
