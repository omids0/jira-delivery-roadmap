// Page shells painted into the overlay iframe. Pure string builders, no DOM.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
:root{--bg:#f4f6f9;--surface:#fff;--ink:#111522;--muted:#737b8f;--line:#d9dee7;--accent:#1d5bb8;--crit:#d03b3b}
@media (prefers-color-scheme:dark){:root{--bg:#0e1117;--surface:#151a23;--ink:#edf0f5;--muted:#868d9e;--line:#2a313e;--accent:#6ea4f2;--crit:#e66767}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.7 Vazirmatn,Tahoma,sans-serif}
header{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
header h1{font-size:17px;margin:0;margin-inline-end:auto}
select,button{font:inherit;padding:5px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink);cursor:pointer}
main{max-width:960px;margin:0 auto;padding:28px 20px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:16px}
.err{color:var(--crit)}
.muted{color:var(--muted)}
.ok{color:#0b8f80;font-weight:700}
ul.notes{margin:10px 0 0;padding-inline-start:20px;color:var(--muted);font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:7px 10px;text-align:start;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:700}
td:first-child{white-space:normal}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 18px}
.fld{display:grid;gap:4px;font-size:13px}
.fld input{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink)}
.actions{display:flex;align-items:center;gap:14px;margin-top:16px}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--surface);font-weight:700;padding:6px 22px}
`;

const wrap = (body) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نقشه راه تحویل Jira</title><style>${CSS}</style></head><body>${body}</body></html>`;

const header = ({ projects, user, key }) => `<header>
  <h1>نقشه راه تحویل</h1>
  <select id="jr-project" aria-label="پروژه">
    <option value=""${key ? '' : ' selected'} disabled>پروژه را انتخاب کنید…</option>
    ${projects.map((p) => `<option value="${esc(p.key)}"${p.key === key ? ' selected' : ''}>${esc(p.key)} — ${esc(p.name)}</option>`).join('')}
  </select>
  <button id="jr-refresh" type="button"${key ? '' : ' disabled'}>بروزرسانی</button>
  <button id="jr-close" type="button">بستن</button>
  ${user ? `<span class="muted">${esc(user)}</span>` : ''}
</header>`;

export const renderLoading = (text) => wrap(`<main style="text-align:center;padding-top:80px" class="muted">${esc(text)}</main>`);

export function renderHome({ projects, user, error = '', fatal = false }) {
  const body = fatal
    ? `<header><h1>نقشه راه تحویل</h1><button id="jr-close" type="button">بستن</button></header>`
    : header({ projects, user, key: null });
  return wrap(`${body}<main>
    ${error ? `<div class="card err">${esc(error)}</div>` : ''}
    ${fatal ? '' : '<div class="card muted">یک پروژه از لیست بالا انتخاب کنید.</div>'}
  </main>`);
}

const field = (id, label, value, attrs = '') =>
  `<label class="fld"><span>${label}</span><input id="${id}" value="${esc(value)}" ${attrs}></label>`;

/** Data-quality notes: what is missing in Jira and what the plan will assume instead. */
export function qualityNotes(s) {
  const notes = [];
  if (s.open > 0 && s.withBlockers === 0) notes.push('هیچ استوری بازی لینک «Blocks» ندارد؛ وابستگی‌ها در نقشه دیده نمی‌شوند و همه‌ی کارها هم‌زمان قابل شروع حساب می‌شوند.');
  if (s.noSubtasks > 0) notes.push(`${s.noSubtasks} استوری باز ساب‌تسک ندارد؛ برای آن‌ها برآورد پیش‌فرض گرفته می‌شود.`);
  if (s.noEpic > 0) notes.push(`${s.noEpic} استوری باز اپیک ندارد؛ در ردیف «بدون اپیک» می‌آیند.`);
  if (s.externalOpen > 0) notes.push(`${s.externalOpen} استوری باز منتظر کاری بیرون از این پروژه است (وابستگی بیرونی).`);
  return notes;
}

const fmt = (c) => `${c.open}<span class="muted"> / ${c.total}</span>`;

function epicTable(s) {
  if (!s.epics.length) return '';
  return `<div class="card" style="overflow-x:auto">
    <h3 style="margin:0 0 10px">اپیک‌ها</h3>
    <table><thead><tr><th>اپیک</th><th>استوری باز</th><th>استوری بسته</th><th>ساب‌تسک بک‌اند (باز / کل)</th><th>ساب‌تسک فرانت (باز / کل)</th></tr></thead><tbody>
    ${s.epics.map((r) => `<tr><td>${r.key ? `<bdi class="muted">${esc(r.key)}</bdi> ` : ''}${esc(r.name ?? 'بدون اپیک')}</td><td>${r.openStories}</td><td>${r.doneStories}</td><td>${fmt(r.be)}</td><td>${fmt(r.fe)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

export function renderProject({ projects, user, key, summary, settings, saved = false }) {
  const num = 'type="number" min="1" max="20" inputmode="numeric"';
  const notes = qualityNotes(summary);
  return wrap(`${header({ projects, user, key })}<main>
    <div class="card">
      <h2 style="margin:0 0 6px">${esc(key)}</h2>
      <p style="margin:0"><b>${summary.open}</b> استوری باز، <b>${summary.done}</b> استوری بسته.</p>
      ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>
    ${epicTable(summary)}
    <div class="card" id="jr-settings">
      <h3 style="margin:0 0 4px">تنظیمات تیم</h3>
      <p class="muted" style="margin:0 0 12px">این تنظیمات فقط در همین مرورگر و برای همین پروژه ذخیره می‌شود.</p>
      <div class="grid">
        ${field('jr-be', 'تعداد نفرات بک‌اند', settings.team.be, num)}
        ${field('jr-fe', 'تعداد نفرات فرانت', settings.team.fe, num)}
        ${field('jr-par', 'استوری هم‌زمان هر نفر', settings.parallelStories, 'type="number" min="1" max="10" inputmode="numeric"')}
        ${field('jr-cbe', 'نام کامپوننت بک‌اند در Jira', settings.components.be, 'dir="ltr"')}
        ${field('jr-cfe', 'نام کامپوننت فرانت در Jira', settings.components.fe, 'dir="ltr"')}
      </div>
      <div class="actions">
        <button id="jr-confirm" type="button" class="primary">تأیید</button>
        ${saved ? '<span class="ok" role="status">ذخیره شد ✓</span>' : ''}
      </div>
    </div>
    <div class="card muted">نمایش نقشه‌ی راه (مسیر بحرانی و خط زمانی نفرات) به‌زودی اضافه می‌شود.</div>
  </main>`);
}
