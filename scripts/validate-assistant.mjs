#!/usr/bin/env node
import http from 'node:http';
import { startAssistantServer } from '../src/assistant-server.js';

async function fetchJson(url, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

const { server, url } = await startAssistantServer({ port: 0 });

try {
  const dash = await fetchJson(`${url}/api/dashboard`);
  if (dash.status !== 200) throw new Error('dashboard failed');
  if (!dash.body.counts) throw new Error('dashboard missing counts');

  const ask = await fetchJson(`${url}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What should I work on today?' }),
  });
  if (ask.status !== 200) throw new Error('ask failed');
  if (!ask.body.message) throw new Error('ask missing message');
  if (!ask.body.computed) throw new Error('ask must declare computed');

  const guidance = await fetchJson(`${url}/api/guidance`);
  if (guidance.status !== 200) throw new Error('guidance failed');

  const html = await new Promise((resolve, reject) => {
    http.get(`${url}/`, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
  if (html.status !== 200 || !html.body.includes('WASSAD')) {
    throw new Error('UI not served');
  }

  const entity = await fetchJson(`${url}/api/entity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: 'Test Project',
      kind: 'origin',
      title: 'Validation origin',
      body: '',
    }),
  });
  if (entity.status !== 200 || !entity.body.entity) throw new Error('entity create failed');

  const backup = await new Promise((resolve, reject) => {
    http.get(`${url}/api/backup`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
  if (backup.status !== 200 || !backup.body.includes('seed_export_format')) {
    throw new Error('backup failed');
  }

  console.log(
    JSON.stringify({
      status: 'PASSED',
      component: 'assistant',
      checks: ['dashboard', 'ask', 'guidance', 'ui', 'entity_create', 'backup'],
      external_services_required: false,
    }),
  );
} catch (e) {
  console.error(JSON.stringify({ status: 'FAILED', error: String(e.message ?? e) }));
  process.exit(1);
} finally {
  server.close();
}
