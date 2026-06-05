import fs from 'node:fs';
import { normalizeEntity } from './model.js';
import { normalizeLink } from './links-model.js';
import { LinkStore } from './link-store.js';
import { PatternStore } from './pattern-store.js';
import { normalizePattern } from './pattern-model.js';
import { OpportunityStore } from './opportunity-store.js';
import { normalizeOpportunity } from './opportunity-model.js';

const EXPORT_FORMAT = '1';

/**
 * @param {import('./vault.js').Vault} vault
 * @param {string} outPath
 */
export function exportVault(vault, outPath) {
  vault.open();
  const links = new LinkStore(vault);
  links.ensureReady();
  const patterns = new PatternStore(vault);
  patterns.ensureReady();
  const opportunities = new OpportunityStore(vault);
  opportunities.ensureReady();

  const entities = vault.list();
  const linkList = links.list();
  const patternList = patterns.list();
  const opportunityList = opportunities.list();

  const bundle = {
    seed_export_format: EXPORT_FORMAT,
    exported_at: new Date().toISOString(),
    manifest: vault.getManifest(),
    entities,
    links: linkList,
    patterns: patternList,
    opportunities: opportunityList,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  return {
    path: outPath,
    entityCount: entities.length,
    linkCount: linkList.length,
    patternCount: patternList.length,
    opportunityCount: opportunityList.length,
  };
}

/**
 * @param {import('./vault.js').Vault} vault
 * @param {string} inPath
 */
export function importVault(vault, inPath) {
  const raw = fs.readFileSync(inPath, 'utf8');
  const bundle = JSON.parse(raw);
  if (bundle.seed_export_format !== EXPORT_FORMAT) {
    throw new Error(
      `Unsupported export format: ${bundle.seed_export_format ?? 'unknown'}. Expected ${EXPORT_FORMAT}.`,
    );
  }
  if (!Array.isArray(bundle.entities)) {
    throw new Error('Invalid export bundle: missing entities array');
  }

  let imported = 0;
  for (const item of bundle.entities) {
    vault.put(normalizeEntity(item));
    imported += 1;
  }

  const links = new LinkStore(vault);
  links.ensureReady();
  let linksImported = 0;
  if (Array.isArray(bundle.links)) {
    for (const item of bundle.links) {
      links.put(normalizeLink(item));
      linksImported += 1;
    }
  }

  const patterns = new PatternStore(vault);
  patterns.ensureReady();
  let patternsImported = 0;
  if (Array.isArray(bundle.patterns) && bundle.patterns.length > 0) {
    for (const item of bundle.patterns) {
      patterns.put(normalizePattern(item));
      patternsImported += 1;
    }
  }

  const opportunities = new OpportunityStore(vault);
  opportunities.ensureReady();
  let opportunitiesImported = 0;
  if (Array.isArray(bundle.opportunities) && bundle.opportunities.length > 0) {
    for (const item of bundle.opportunities) {
      opportunities.put(normalizeOpportunity(item));
      opportunitiesImported += 1;
    }
  }

  return {
    imported,
    totalInBundle: bundle.entities.length,
    linksImported,
    linksInBundle: Array.isArray(bundle.links) ? bundle.links.length : 0,
    patternsImported,
    patternsInBundle: Array.isArray(bundle.patterns) ? bundle.patterns.length : 0,
    opportunitiesImported,
    opportunitiesInBundle: Array.isArray(bundle.opportunities) ? bundle.opportunities.length : 0,
  };
}
