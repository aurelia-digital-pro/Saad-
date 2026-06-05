import path from 'node:path';
import { Vault } from '../vault.js';
import { ContextEngine } from '../context.js';
import { PatternEngine } from '../pattern-engine.js';
import { OpportunityEngine } from '../opportunity-engine.js';
import { LinkStore } from '../link-store.js';
import { SystemAnalyzer } from './analyzer.js';

/**
 * Unified SEED system — Vault → Context → Pattern → Opportunity.
 */
export class SeedSystem {
  /** @param {string} vaultPath */
  constructor(vaultPath) {
    this.vaultPath = path.resolve(vaultPath);
    this.vault = new Vault(this.vaultPath);
    if (!this.vault.exists()) {
      this.vault.init();
    } else {
      this.vault.open();
    }
    this.context = new ContextEngine(this.vault);
    this.patterns = new PatternEngine(this.vault);
    this.opportunities = new OpportunityEngine(this.vault);
    this.links = this.context.links;
    this.analyzer = new SystemAnalyzer(this);
  }

  /** Refresh computed layers from stored data. */
  refresh() {
    const patternResult = this.patterns.discover({ minOccurrences: 2 });
    const opportunityResult = this.opportunities.discover({ minPatternOccurrences: 2 });
    return {
      patterns: patternResult,
      opportunities: opportunityResult,
      computed: true,
    };
  }

  getStatus() {
    return this.analyzer.dashboard();
  }
}
