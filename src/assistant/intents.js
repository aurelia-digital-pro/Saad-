/**
 * Deterministic intent routing from natural-language questions.
 * No LLM — keyword and phrase matching only.
 */

const INTENTS = [
  {
    id: 'daily',
    patterns: [
      /work on today/i,
      /should i (work|focus|do)/i,
      /priorit/i,
      /today\?/i,
      /ماذا.*(أفعل|اعمل|اليوم)/,
      /التركيز.*اليوم/,
      /ماذا يجب/,
    ],
  },
  {
    id: 'stalled',
    patterns: [
      /stalled/i,
      /stuck/i,
      /blocked/i,
      /not moving/i,
      /projects?.*stall/i,
      /متوقف/,
      /عالق/,
      /مشروع.*متوقف/,
    ],
  },
  {
    id: 'patterns',
    patterns: [/patterns?/i, /recurring/i, /repeat/i, /see.*pattern/i, /أنماط/, /نمط/],
  },
  {
    id: 'opportunities',
    patterns: [/opportunit/i, /reuse/i, /potential/i, /فرص/, /فرصة/],
  },
  {
    id: 'problems',
    patterns: [
      /problem/i,
      /attention/i,
      /gap/i,
      /missing link/i,
      /incomplete/i,
      /wrong/i,
      /مشاكل/,
      /انتباه/,
      /يحتاج.*اهتمام/,
    ],
  },
  {
    id: 'recent',
    patterns: [/changed/i, /recent/i, /lately/i, /what.*new/i, /activity/i, /حديث/, /تغيير/],
  },
  {
    id: 'projects',
    patterns: [/projects?/i, /مشاريع/],
  },
  {
    id: 'dashboard',
    patterns: [/dashboard/i, /status/i, /health/i, /overview/i, /summary/i, /لوحة/, /نظرة/],
  },
  {
    id: 'help',
    patterns: [/^\s*help\s*$/i, /what can you/i, /how do i use/i, /مساعدة/, /مساعدة/],
  },
];

/**
 * @param {string} message
 */
export function detectIntent(message) {
  const text = String(message ?? '').trim();
  if (!text) return { id: 'dashboard', confidence: 1 };

  for (const intent of INTENTS) {
    for (const re of intent.patterns) {
      if (re.test(text)) {
        return { id: intent.id, confidence: 1, matched: re.source };
      }
    }
  }

  return { id: 'daily', confidence: 0.5, fallback: true };
}

export function helpText(lang = 'en') {
  if (lang === 'ar') {
    return `يمكنك أن تسألني مثلاً:

• ماذا يجب أن أعمل اليوم؟
• ما المشاريع المتوقفة؟
• ما الأنماط التي تراها؟
• ما الفرص المتاحة؟
• ما المشاكل التي تحتاج انتباهي؟
• ما الذي تغيّر مؤخراً؟

أجيب فقط من ذاكرتك المحلية — كل إجابة مع أدلة من بياناتك المخزنة.`;
  }
  return `You can ask me things like:

• What should I work on today?
• What projects are stalled?
• What patterns do you see?
• What opportunities exist?
• What problems need attention?
• What changed recently?

I answer only from your local vault — entities, links, patterns, and opportunities stored on this machine. Every answer includes supporting evidence.`;
}
