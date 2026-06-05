export const UI = {
  en: {
    brand: 'WASSAD',
    tagline: 'Your sovereign operating assistant',
    greeting: 'Good evening',
    focus: 'What should I do now?',
    offline: 'Offline · Local memory',
    refresh: 'Refresh memory',
    backup: 'Backup now',
    search: 'Search memory…',
    nav_home: 'Home',
    nav_projects: 'Projects',
    risks: 'Risks & alerts',
    opportunities: 'Opportunities',
    stalled: 'Stalled work',
    projects: 'Projects',
    chat_title: 'Chat with WASSAD',
    chat_placeholder: 'Ask from your memory…',
    send: 'Send',
    guidance: 'Active guidance',
    stalled_list: 'Stalled projects',
    recent: 'Latest changes',
    integrations: 'Integrations',
    integrations_note: 'Optional — not required. Your data stays on this device.',
    not_connected: 'Not connected',
    add_title: 'Add to memory',
    project_name: 'Project name',
    step_kind: 'Step type',
    title: 'Title',
    details: 'Details (optional)',
    save: 'Save',
    cancel: 'Cancel',
    quick_origin: 'New origin',
    quick_decision: 'New decision',
    welcome:
      'Welcome to **WASSAD**. I answer only from **your local memory** on this device. Ask a question or use the suggestions below.',
    memory_ok: 'Smart memory — synchronized locally',
    footer: 'Stored data is authority. Computed insights are reproducible from your vault.',
    chips: [
      'What should I work on today?',
      'What projects are stalled?',
      'What patterns do you see?',
      'What opportunities exist?',
      'What problems need attention?',
    ],
  },
  ar: {
    brand: 'وسّاد',
    tagline: 'مساعدك السيادي للعمل اليومي',
    greeting: 'مساء الخير',
    focus: 'ماذا يجب أن أفعل الآن؟',
    offline: 'بدون إنترنت · ذاكرة محلية',
    refresh: 'تحديث الذاكرة',
    backup: 'نسخ احتياطي',
    search: 'ابحث في الذاكرة…',
    nav_home: 'الرئيسية',
    nav_projects: 'المشاريع',
    risks: 'مخاطر وتنبيهات',
    opportunities: 'فرص',
    stalled: 'عمل متوقف',
    projects: 'مشاريع',
    chat_title: 'محادثة مع وسّاد',
    chat_placeholder: 'اسأل من ذاكرتك…',
    send: 'إرسال',
    guidance: 'إرشاد نشط',
    stalled_list: 'مشاريع متوقفة',
    recent: 'آخر التغييرات',
    integrations: 'تكاملات',
    integrations_note: 'اختياري — غير مطلوب. بياناتك تبقى على هذا الجهاز.',
    not_connected: 'غير متصل',
    add_title: 'إضافة للذاكرة',
    project_name: 'اسم المشروع',
    step_kind: 'نوع الخطوة',
    title: 'العنوان',
    details: 'تفاصيل (اختياري)',
    save: 'حفظ',
    cancel: 'إلغاء',
    quick_origin: 'بداية جديدة',
    quick_decision: 'قرار جديد',
    welcome:
      'مرحباً في **وسّاد**. أجيب فقط من **ذاكرتك المحلية** على هذا الجهاز. اسأل سؤالاً أو استخدم الاقتراحات أدناه.',
    memory_ok: 'ذاكرة ذكية — متزامنة محلياً',
    footer: 'البيانات المخزنة هي المرجع. الرؤى محسوبة من خزنتك وقابلة للتتبع.',
    chips: [
      'ماذا يجب أن أعمل اليوم؟',
      'ما المشاريع المتوقفة؟',
      'ما الأنماط التي تراها؟',
      'ما الفرص المتاحة؟',
      'ما المشاكل التي تحتاج انتباهي؟',
    ],
  },
};

export function getLang() {
  return localStorage.getItem('wassad_lang') || 'ar';
}

export function setLang(lang) {
  localStorage.setItem('wassad_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function t(key) {
  const lang = getLang();
  return UI[lang]?.[key] ?? UI.en[key] ?? key;
}
