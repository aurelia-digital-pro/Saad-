import { UI, getLang, setLang, t } from './i18n.js';

function renderMarkdownLite(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function applyI18n() {
  const lang = getLang();
  setLang(lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (UI[lang][key]) el.textContent = UI[lang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (UI[lang][key]) el.placeholder = UI[lang][key];
  });
  document.getElementById('lang-ar')?.classList.toggle('active', lang === 'ar');
  document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');

  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  UI[lang].chips.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = q;
    b.addEventListener('click', () => ask(q));
    chips.appendChild(b);
  });
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Seed-Lang': getLang(),
      ...options.headers,
    },
  }).then((r) => r.json());
}

function addMessage(role, html, evidence) {
  const log = document.getElementById('chat-log');
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = html;
  if (evidence?.length) {
    const ev = document.createElement('div');
    ev.className = 'evidence';
    ev.textContent = `${getLang() === 'ar' ? 'دليل' : 'Evidence'}: ${JSON.stringify(evidence).slice(0, 500)}`;
    el.appendChild(ev);
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function ask(message) {
  addMessage('user', renderMarkdownLite(message));
  const data = await api('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ message, lang: getLang() }),
  });
  addMessage('bot', renderMarkdownLite(data.message), data.evidence);
}

async function loadDashboard() {
  const d = await api('/api/dashboard');
  const row = document.getElementById('metrics-row');
  const cards = [
    { cls: 'risk', val: d.risks_count, lbl: t('risks') },
    { cls: 'opp', val: d.counts.opportunities, lbl: t('opportunities') },
    { cls: 'warn', val: d.stalled_count, lbl: t('stalled') },
    { cls: '', val: d.counts.projects, lbl: t('projects') },
  ];
  row.innerHTML = cards
    .map(
      (c) =>
        `<div class="metric-card ${c.cls}"><div class="val">${c.val}</div><div class="lbl">${c.lbl}</div></div>`,
    )
    .join('');

  const focus = document.getElementById('focus-now');
  if (!d.focus_now?.length) {
    focus.innerHTML = `<li>${getLang() === 'ar' ? 'لا أولويات عاجلة — أضف مشروعاً أو حدّث الذاكرة.' : 'No urgent priorities — add a project or refresh memory.'}</li>`;
  } else {
    focus.innerHTML = d.focus_now.map((p) => `<li>${p.summary}</li>`).join('');
  }

  const recent = document.getElementById('recent-list');
  recent.innerHTML = (d.recent_activity ?? [])
    .map((r) => `<div class="item"><strong>${r.kind}</strong> ${r.title}<br><small>${r.updated_at}</small></div>`)
    .join('') || `<div class="item muted">—</div>`;

  const projects = document.getElementById('projects-list');
  projects.innerHTML = (d.projects ?? [])
    .map(
      (p) =>
        `<div class="item"><strong>${p.name}</strong> — ${p.entity_count} · ~${p.progress_percent}%<div class="progress"><span style="width:${p.progress_percent}%"></span></div>${p.stalled_count ? `<small class="risk">${t('stalled')}: ${p.stalled_count}</small>` : ''}</div>`,
    )
    .join('') || `<div class="item muted">—</div>`;
}

async function loadGuidance() {
  const g = await api('/api/guidance');
  const stalled = document.getElementById('stalled-projects');
  const items = (g.stalled ?? []).map(
    (s) => `<div class="item"><strong>${s.title}</strong><br><small>${s.kind} — ${s.reason}</small></div>`,
  );
  stalled.innerHTML = items.join('') || `<div class="item muted">—</div>`;

  const list = document.getElementById('guidance-list');
  const parts = [];
  for (const o of g.opportunities ?? []) {
    parts.push(`<div class="item">${getLang() === 'ar' ? 'فرصة' : 'Opportunity'}: ${(o.missing_steps ?? []).map((s) => s.kind).join('→')}</div>`);
  }
  for (const p of g.patterns ?? []) {
    parts.push(`<div class="item">${getLang() === 'ar' ? 'نمط' : 'Pattern'} (${p.occurrence_count}×)</div>`);
  }
  list.innerHTML = parts.join('') || `<div class="item muted">—</div>`;
}

async function refreshAll() {
  await api('/api/refresh', { method: 'POST' });
  await loadDashboard();
  await loadGuidance();
}

function updateClock() {
  const el = document.getElementById('datetime-line');
  const locale = getLang() === 'ar' ? 'ar-SA' : 'en-US';
  el.textContent = new Date().toLocaleString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const dialog = document.getElementById('add-dialog');
const form = document.getElementById('add-form');

function openAdd(kind = 'origin', project = '') {
  form.kind.value = kind;
  form.project.value = project;
  dialog.showModal();
}

document.querySelectorAll('.qa[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => openAdd(btn.dataset.add));
});
document.querySelector('.qa[data-open-add]')?.addEventListener('click', () => openAdd());

document.getElementById('add-cancel').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  await api('/api/entity', {
    method: 'POST',
    body: JSON.stringify({
      project: fd.get('project'),
      kind: fd.get('kind'),
      title: fd.get('title'),
      body: fd.get('body') ?? '',
    }),
  });
  dialog.close();
  await refreshAll();
  addMessage(
    'bot',
    getLang() === 'ar'
      ? `تم الحفظ في المشروع «${fd.get('project')}».`
      : `Saved to project "${fd.get('project')}".`,
  );
});

document.getElementById('btn-refresh').addEventListener('click', refreshAll);
document.getElementById('btn-backup').addEventListener('click', () => {
  window.location.href = '/api/backup';
});

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  await ask(msg);
});

document.getElementById('lang-ar').addEventListener('click', () => {
  setLang('ar');
  applyI18n();
  loadDashboard();
  loadGuidance();
});
document.getElementById('lang-en').addEventListener('click', () => {
  setLang('en');
  applyI18n();
  loadDashboard();
  loadGuidance();
});

document.getElementById('search')?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await ask(e.target.value);
  }
});

applyI18n();
updateClock();
setInterval(updateClock, 60000);

addMessage('bot', renderMarkdownLite(t('welcome')));
loadDashboard();
loadGuidance();
