export const STRINGS = {
  en: {
    focus_title: "What should I do now?",
    welcome:
      'Welcome to **WASSAD**. I answer only from **your local memory** on this device — not from the internet.',
    no_items: 'No urgent items. Add a project step below or refresh memory.',
    stalled_none: 'No stalled work in your memory.',
    patterns_none: 'No repeated patterns yet. Patterns appear after the same chain occurs twice.',
    opportunities_none:
      'No opportunities yet. They appear when history supports completing an in-progress chain.',
    problems_none: 'No problems detected in stored data.',
    recent_none: 'No recent activity — memory is empty.',
  },
  ar: {
    focus_title: 'ماذا يجب أن أفعل الآن؟',
    welcome:
      'مرحباً في **وسّاد**. أجيب فقط من **ذاكرتك المحلية** على هذا الجهاز — وليس من الإنترنت.',
    no_items: 'لا توجد عناصر عاجلة. أضف خطوة لمشروع أدناه أو حدّث الذاكرة.',
    stalled_none: 'لا يوجد عمل متوقف في ذاكرتك.',
    patterns_none: 'لا توجد أنماط متكررة بعد. تظهر عندما يتكرر نفس السلسلة مرتين.',
    opportunities_none:
      'لا توجد فرص بعد. تظهر عندما يدعم التاريخ إكمال سلسلة قيد التقدم.',
    problems_none: 'لا توجد مشاكل في البيانات المخزنة.',
    recent_none: 'لا يوجد نشاط حديث — الذاكرة فارغة.',
  },
};

export function langFromRequest(body, headers) {
  const q = body?.lang ?? headers?.['x-seed-lang'];
  if (q === 'ar' || q === 'en') return q;
  return 'en';
}
