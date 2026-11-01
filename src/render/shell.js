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

export function renderProject({ projects, user, key, openStories, settings, saved = false }) {
  const num = 'type="number" min="1" max="20" inputmode="numeric"';
  return wrap(`${header({ projects, user, key })}<main>
    <div class="card">
      <h2 style="margin:0 0 6px">${esc(key)}</h2>
      <p style="margin:0"><b>${openStories}</b> استوری باز در این پروژه.</p>
    </div>
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
