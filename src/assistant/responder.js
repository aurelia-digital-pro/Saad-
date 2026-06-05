import { detectIntent, helpText } from './intents.js';
import { STRINGS } from './i18n.js';
import { projectSummaries } from './projects.js';

/**
 * @param {import('./system.js').SeedSystem} system
 * @param {string} message
 * @param {'en'|'ar'} [lang]
 */
export function respondToMessage(system, message, lang = 'en') {
  const intent = detectIntent(message);
  const L = STRINGS[lang] ?? STRINGS.en;
  const analyzer = system.analyzer;
  let reply = '';
  /** @type {object[]} */
  const evidence = [];

  switch (intent.id) {
    case 'projects': {
      const projects = projectSummaries(system);
      if (projects.length === 0) {
        reply = lang === 'ar' ? 'لا توجد مشاريع بعد.' : 'No projects in memory yet.';
      } else {
        const title = lang === 'ar' ? '**مشاريعك**' : '**Your projects**';
        reply = `${title}\n\n${projects
          .map(
            (p, i) =>
              `${i + 1}. **${p.name}** — ${p.entity_count} items, progress ~${p.progress_percent}%, stalled ${p.stalled_count}`,
          )
          .join('\n')}`;
        projects.forEach((p) => evidence.push(p.evidence));
      }
      break;
    }
    case 'daily': {
      const brief = analyzer.dailyBrief();
      const lines = [
        lang === 'ar'
          ? `**${L.focus_title}** (من ذاكرتك المحلية)\n`
          : `**${L.focus_title}** (from your stored memory)\n`,
      ];
      if (brief.priorities.length === 0) {
        lines.push(L.no_items);
      } else {
        brief.priorities.forEach((p, i) => {
          lines.push(`${i + 1}. ${p.summary}`);
          evidence.push(p.evidence);
        });
      }
      if (brief.top_patterns.length > 0) {
        lines.push(lang === 'ar' ? '\n**سلاسل ناجحة متكررة:**' : '\n**Recurring successful chains:**');
        for (const p of brief.top_patterns) {
          lines.push(`• (${p.occurrence_count}×) ${p.steps.join(' → ')}`);
          evidence.push(p.evidence);
        }
      }
      reply = lines.join('\n');
      break;
    }
    case 'stalled': {
      const stalled = analyzer.stalledItems();
      if (stalled.length === 0) {
        reply = L.stalled_none;
      } else {
        const hdr = lang === 'ar' ? `**عمل متوقف (${stalled.length})**` : `**Stalled items (${stalled.length})**`;
        reply = `${hdr}\n\n${stalled
          .map(
            (s, i) =>
              `${i + 1}. **${s.kind}** "${s.title}" — ${s.reason}`,
          )
          .join('\n')}`;
        stalled.forEach((s) => evidence.push(s.evidence));
      }
      break;
    }
    case 'patterns': {
      const patterns = analyzer.recurringSuccesses();
      if (patterns.length === 0) {
        reply = L.patterns_none;
      } else {
        const hdr = lang === 'ar' ? `**أنماط (${patterns.length})**` : `**Patterns (${patterns.length})**`;
        reply = `${hdr}\n\n${patterns
          .map(
            (p, i) =>
              `${i + 1}. **${p.occurrence_count}×** (confidence ${p.confidence_score.toFixed(2)})\n   ${p.steps.join(' → ')}\n   _${p.explanation.slice(0, 120)}…_`,
          )
          .join('\n\n')}`;
        patterns.forEach((p) => evidence.push(p.evidence));
      }
      break;
    }
    case 'opportunities': {
      const opps = system.opportunities.list();
      if (opps.length === 0) {
        reply = L.opportunities_none;
      } else {
        const hdr =
          lang === 'ar' ? `**فرص (${opps.length})**` : `**Opportunities (${opps.length})**`;
        reply = `${hdr}\n\n${opps
          .map((o, i) => {
            const missing = o.missing_steps.map((s) => s.display_title ?? s.title).join(' → ');
            return `${i + 1}. Complete: **${missing}**\n   Supported by pattern (${o.supporting_pattern_occurrences}×), confidence ${o.confidence_score.toFixed(2)}\n   ${o.explanation}`;
          })
          .join('\n\n')}`;
        opps.forEach((o) =>
          evidence.push({
            opportunity_id: o.id,
            pattern_id: o.pattern_id,
            prefix_entity_ids: o.prefix_entity_ids,
          }),
        );
      }
      break;
    }
    case 'problems': {
      const incomplete = analyzer.incompleteChains();
      const gaps = analyzer.suspiciousGaps();
      const parts = [];
      if (incomplete.length > 0) {
        parts.push(
          `**Incomplete chains (${incomplete.length})**\n${incomplete
            .map(
              (c, i) =>
                `${i + 1}. Ends at **${c.ends_at_kind}**: ${c.chain_titles.join(' → ')}\n   Missing: ${c.missing_kinds.join(', ')}`,
            )
            .join('\n')}`,
        );
        incomplete.forEach((c) => evidence.push(c.evidence));
      }
      if (gaps.length > 0) {
        parts.push(
          `\n**Gaps (${gaps.length})**\n${gaps
            .map((g, i) => `${i + 1}. ${g.type}: "${g.title}" (${g.kind ?? 'origin'})`)
            .join('\n')}`,
        );
        gaps.forEach((g) => evidence.push(g.evidence));
      }
      reply = parts.length > 0 ? parts.join('\n') : L.problems_none;
      break;
    }
    case 'recent': {
      const recent = analyzer.recentActivity(12);
      if (recent.length === 0) {
        reply = L.recent_none;
      } else {
        const hdr = lang === 'ar' ? '**نشاط حديث**' : '**Recent activity**';
        reply = `${hdr}\n\n${recent
          .map((r, i) => `${i + 1}. **${r.kind}** "${r.title}" — ${r.updated_at}`)
          .join('\n')}`;
        recent.forEach((r) => evidence.push(r.evidence));
      }
      break;
    }
    case 'dashboard': {
      const d = analyzer.dashboard();
      if (lang === 'ar') {
        reply = `**نظرة عامة**

• عناصر: ${d.counts.entities}
• روابط: ${d.counts.links}
• أنماط: ${d.counts.patterns}
• فرص: ${d.counts.opportunities}
• مشاريع: ${d.counts.projects}
• متوقف: ${d.stalled_count}
• سلاسل غير مكتملة: ${d.incomplete_chain_count}

**الصحة:** ${d.system_health.status} — ${d.system_health.notes.join(' ') || 'جيد.'}`;
      } else {
        reply = `**System overview**

• Entities: ${d.counts.entities}
• Links: ${d.counts.links}
• Patterns: ${d.counts.patterns}
• Opportunities: ${d.counts.opportunities}
• Projects: ${d.counts.projects}
• Stalled: ${d.stalled_count}
• Incomplete chains: ${d.incomplete_chain_count}

**Health:** ${d.system_health.status} — ${d.system_health.notes.join(' ') || 'All clear.'}`;
      }
      evidence.push({ dashboard: d.counts });
      break;
    }
    case 'help':
    default:
      reply = helpText(lang);
      break;
  }

  return {
    intent: intent.id,
    message: reply,
    evidence,
    computed: true,
    source: 'vault_entities_links_patterns_opportunities',
    no_external_ai: true,
    lang,
  };
}
