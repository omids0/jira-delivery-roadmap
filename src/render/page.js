// The roadmap page: static frame (header, controls, section containers). The
// sections themselves are filled by src/browser/roadmap-ui.js, which calls the
// renderers and sets innerHTML by id, so a control change never rewrites the page.
import { CSS } from './style.js';

const EXTRA_CSS = `
.jr-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:10px 20px;background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.jr-bar b{font-size:14px;margin-inline-end:auto}
.jr-bar select,.jr-bar button{font:inherit;font-size:13px;padding:4px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--fg);cursor:pointer}
.jr-bar .who{color:var(--muted);font-size:12.5px}
.set-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 18px}
.fld{display:grid;gap:4px;font-size:13px}
.fld input{font:inherit;padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--fg)}
.q-notes{margin:6px 0 0;padding-inline-start:20px;color:var(--fg2);font-size:13px}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const html = (body) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نقشه راه تحویل Jira</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
<style>${CSS}${EXTRA_CSS}</style></head><body>${body}</body></html>`;

export const renderLoading = (text) => html(`<main style="text-align:center;padding:80px 20px;color:var(--muted)">${esc(text)}</main>`);

const bar = ({ projects, user, key }) => `<div class="jr-bar">
  <b>نقشه راه تحویل</b>
  <select id="jr-project" aria-label="پروژه">
    <option value=""${key ? '' : ' selected'} disabled>پروژه را انتخاب کنید…</option>
    ${projects.map((p) => `<option value="${esc(p.key)}"${p.key === key ? ' selected' : ''}>${esc(p.key)} — ${esc(p.name)}</option>`).join('')}
  </select>
  <button id="jr-close" type="button">بستن</button>
  ${user ? `<span class="who">${esc(user)}</span>` : ''}
</div>`;

/** Home / error page: only the project picker. */
export function renderHome({ projects, user, error = '', fatal = false }) {
  return html(`${fatal ? `<div class="jr-bar"><b>نقشه راه تحویل</b><button id="jr-close" type="button">بستن</button></div>` : bar({ projects, user, key: null })}
  <div class="wrap">${error ? `<div class="note" style="color:var(--crit)">${esc(error)}</div>` : ''}
  ${fatal ? '' : '<p class="lead">یک پروژه از لیست بالا انتخاب کنید.</p>'}</div>`);
}

/** "شنبه تا چهارشنبه" from the weekend day numbers. */
export function workweekLabel(weekend, locale) {
  const f = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const sat = new Date(2024, 0, 6); // a Saturday
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sat);
    d.setDate(sat.getDate() + i);
    if (!weekend.includes(d.getDay())) days.push(f.format(d));
  }
  return days.length > 2 ? `${days[0]} تا ${days[days.length - 1]}` : days.join('، ');
}

/**
 * @param {object} R   render environment
 * @param {object} o   { projects, user, key, projectName, settings, saved, notes: string[] }
 */
export function renderPage(R, { projects, user, key, projectName, settings, saved = false, notes = [] }) {
  const { ctx, state, fa, cal } = R;
  const count = (f) => ctx.stories.filter((s) => s.f.includes(f)).length;
  const toggle = (id, label, n, on) => (n ? `<label class="toggle"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span>${label} (${fa(n, 0)} استوری)</span></label>` : '');
  const sprintNames = ctx.SPRINTS.map((s) => s.n);
  const paceBasis = sprintNames.length
    ? `با سرعت واقعی تیم در اسپرینت‌های ${esc(sprintNames.join(' و '))} تنظیم شده است`
    : 'با سرعت فرضی تنظیم شده است، چون سابقهٔ اسپرینت بسته‌شده‌ای پیدا نشد';
  const pace = (v, label) => `<label><input type="radio" name="pace" id="pace-${v}" value="${v}"${state.pace === v ? ' checked' : ''}><span>${label}</span></label>`;
  const stepper = (id, label, dot, val) => `<div class="stepper">${dot ? `<span class="role-dot ${dot}" aria-hidden="true"></span>` : ''}<span class="lbl">${label}</span>
      <button type="button" id="${id}-dec" aria-label="کم کردن ${label}">−</button><output id="${id}-n">${fa(val, 0)}</output><button type="button" id="${id}-inc" aria-label="اضافه کردن ${label}">+</button></div>`;
  const fld = (id, label, v, extra = '') => `<label class="fld"><span>${label}</span><input id="${id}" value="${esc(v)}" ${extra}></label>`;

  return html(`${bar({ projects, user, key })}
<div class="wrap" dir="rtl" lang="fa">
  <header class="top">
    <div class="eyebrow">پروژه ${esc(key)} · کل بک‌لاگ، بدون توجه به اسپرینت</div>
    <h1>نقشه راه تحویل ${esc(projectName || key)}</h1>
    <p class="lead">کوتاه‌ترین مسیر برای بستن همهٔ استوری‌های باز، بر اساس وابستگی‌ها و ظرفیت تیم بک‌اند و فرانت. مدت هر کار ${paceBasis}، یعنی تعداد sub-taskهایی که هر نفر در هر روز کاری می‌بندد. اگر تعداد نفرات یا سناریوی سرعت را تغییر دهید، کل برنامه، مسیر بحرانی و تاریخ تحویل دوباره محاسبه می‌شوند.</p>
    <div class="sheet-meta">
      <span>منبع: <b>Jira · ${esc(key)}</b> (همهٔ استوری‌ها و اپیک‌ها)</span>
      <span>وضعیت استوری‌ها: <b id="data-age">Jira، ${esc(cal.fmtAt.format(new Date()))}</b></span>
      <span>شروع برنامه: <b id="today">${esc(cal.fmtDY.format(cal.START))}</b></span>
      <span>تقویم کاری: <b>${esc(workweekLabel(ctx.weekend, ctx.locale))}</b></span>
      <span>واحد برآورد: <b>sub-task</b>، تبدیل به روز با سرعت تیم</span>
    </div>
  </header>

  <div class="controls" role="group" aria-label="تنظیم تیم">
    ${stepper('be', 'بک‌اند', 'be', state.be)}
    ${stepper('fe', 'فرانت', 'fe', state.fe)}
    ${stepper('par', 'استوری همزمان هر نفر', '', state.par)}
    <span class="sep" aria-hidden="true"></span>
    <div class="seg" role="radiogroup" aria-label="سناریوی سرعت">
      ${pace('avg', 'میانگین اسپرینت‌های قبل')}${pace('opt', 'خوش‌بینانه')}${pace('pes', 'محتاطانه')}
    </div>
    <span class="sep" aria-hidden="true"></span>
    ${toggle('opt-p2', 'فاز ۲ (phase-2)', count('p2'), state.p2)}
    ${toggle('opt-p3', 'فاز ۳ (phase-3)', count('p3'), state.p3)}
    <label class="toggle"><input type="checkbox" id="opt-hist"${state.hist ? ' checked' : ''}><span>استوری‌های انجام‌شدهٔ قبلی</span></label>
    ${toggle('opt-def', 'موارد به‌تعویق‌افتاده (deferred)', count('def'), state.def)}
    <div class="refresh">
      <button type="button" class="btn" id="refresh-btn"><span class="ico" aria-hidden="true">↻</span>بروزرسانی از Jira</button>
      <span class="r-status" id="refresh-status" aria-live="polite"></span>
    </div>
  </div>

  <details class="own" id="settings-box">
    <summary>تنظیمات پروژه و کیفیت دیتا</summary>
    <div class="own-body">
      <p class="lead" style="font-size:13px">اسم کامپوننت‌های Jira برای تشخیص کار بک‌اند و فرانت. فقط در همین مرورگر و برای همین پروژه ذخیره می‌شود.</p>
      <div class="set-grid">
        ${fld('jr-cbe', 'نام کامپوننت بک‌اند در Jira', settings.components.be, 'dir="ltr"')}
        ${fld('jr-cfe', 'نام کامپوننت فرانت در Jira', settings.components.fe, 'dir="ltr"')}
      </div>
      <div><button type="button" class="btn" id="jr-confirm">تأیید</button> ${saved ? '<span class="r-status ok" role="status">ذخیره شد ✓</span>' : ''}</div>
      ${notes.length ? `<ul class="q-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>
  </details>

  <div class="kpis" id="kpis"></div>
  <div class="whatif" id="whatif"></div>

  <section class="block" id="overview">
    <div class="block-head">
      <div>
        <h2>نقشهٔ کلی پروژه</h2>
        <p class="lead">همهٔ اپیک‌ها از اولین استوری بسته‌شده تا تاریخ تحویل برنامه‌ریزی‌شده. هر نقطه یک استوری Done در روز بسته شدنش است. نوار نازک بازهٔ کار انجام‌شده و نوار هاشورخورده باقی‌ماندهٔ برنامه را نشان می‌دهد. ردیف بالا تعداد استوری‌های بسته‌شده در هر هفته است، چه واقعی و چه برنامه‌ریزی‌شده.</p>
      </div>
      <div class="legend" id="legend-ov"></div>
    </div>
    <div class="ov-progress" id="ov-progress"></div>
    <div class="gantt-scroll"><div class="ov" id="ov"></div></div>
  </section>

  <section class="block">
    <div class="block-head">
      <div>
        <h2>سرعت واقعی تیم</h2>
        <p class="lead">مبنای کالیبراسیون، تعداد sub-taskهایی است که تا لحظهٔ بستن هر اسپرینت Done شده‌اند. تعداد روزهای کاری هم بر اساس تاریخ واقعی بسته شدن اسپرینت حساب شده است.</p>
      </div>
    </div>
    <div class="tbl-scroll"><table id="vel-tbl"></table></div>
    <p class="lead" style="font-size:13px" id="vel-note"></p>
  </section>

  <section class="block" id="flow-sec">
    <div class="block-head">
      <div>
        <h2>فلوچارت وابستگی‌ها</h2>
        <p class="lead">هر ردیف یک اپیک است و هر ستون یک گام. هر کارت فقط به کارت‌های ستون‌های قبل وابسته است. کارت‌های ستون اول را می‌توان همین امروز شروع کرد. با کلیک روی هر کارت، زنجیرهٔ پیش‌نیازها و کارهایی که به آن وابسته‌اند نمایش داده می‌شود.</p>
      </div>
      <div class="legend" id="legend-flow"></div>
    </div>
    <form class="flow-filter" id="flow-filter" role="search">
      <label for="flow-q">فیلتر با کد استوری</label>
      <input id="flow-q" type="search" placeholder="مثلاً 1415" dir="ltr" autocomplete="off" spellcheck="false">
      <button type="submit" class="btn">نمایش مسیر</button>
      <button type="button" class="btn ghost" id="flow-clear">نمایش همه</button>
      <span class="fq-legend"><i class="ln up"></i>پیش‌نیازها <i class="ln down"></i>استوری‌های وابسته</span>
      <span class="fq-status" id="flow-q-status" aria-live="polite"></span>
    </form>
    <div class="sel-info" id="sel-info" aria-live="polite">کارتی را انتخاب کنید.</div>
    <div class="flow-scroll"><div class="flow" id="flow"></div></div>
  </section>

  <section class="block">
    <div class="block-head">
      <div>
        <h2>خط زمانی نفرات</h2>
        <p class="lead">هر ردیف یک نفر است و هر نفر چند خط موازی دارد. در هر خط یک استوری پیش می‌رود، ولی دو استوری از یک اپیک هم‌زمان روی یک نفر قرار نمی‌گیرند. خروجی روزانهٔ هر نفر همان سرعتی است که ${sprintNames.length ? `در اسپرینت‌های ${esc(sprintNames.join(' و '))} اندازه‌گیری شد` : 'فرض شده است'} و بین خط‌هایش تقسیم می‌شود. بنابراین موازی‌کاری کل کار را کم نمی‌کند، فقط چند اپیک را هم‌زمان جلو می‌برد. فرانت به روش قرارداد-اول کار می‌کند: وقتی نیمی از کار بک‌اند همان استوری انجام شد، بر اساس قرارداد API شروع می‌کند و حداقل یک‌دهم روز بعد از تمام شدن بک‌اند تحویل می‌دهد. کادر پررنگ مسیر بحرانی را نشان می‌دهد. هر تأخیری روی این مسیر، تاریخ تحویل را عقب می‌برد.</p>
      </div>
      <div class="legend" id="legend-gantt"></div>
    </div>
    <details class="own" id="own-box" open>
      <summary>تخصیص اپیک‌ها به نفرات <span class="own-sum" id="own-sum"></span></summary>
      <div class="own-body">
        <p class="lead" style="font-size:13px">هر اپیک یک مسئول بک‌اند و یک مسئول فرانت دارد. همهٔ کارهای آن نقش در آن اپیک فقط به همان نفر می‌رسد. اپیکی که کار فرانت یا بک‌اند ندارد، فقط برای نقشی که کار دارد مسئول می‌گیرد. با یک نفر در هر نقش، همهٔ اپیک‌ها به همان نفر می‌رسد. اپیک‌هایی که دستی تعیین نشده‌اند، خودکار به کم‌کارترین نفر داده می‌شوند. انتخاب‌ها با کلید اپیک در همین مرورگر ذخیره می‌شوند و با رفرش صفحه عوض نمی‌شوند.</p>
        <div class="tbl-scroll"><table id="own-tbl"></table></div>
        <div><button type="button" class="btn ghost" id="own-auto">تقسیم خودکار دوباره</button> <span class="fq-status" id="own-status" aria-live="polite"></span></div>
      </div>
    </details>
    <div class="gantt-scroll" id="gantt-scroll"><div class="gantt" id="gantt"></div></div>
  </section>

  <section class="block" id="people-sec">
    <div class="block-head">
      <div>
        <h2>کارهای باز هر نفر</h2>
        <p class="lead">همهٔ تسک‌ها، sub-taskها، باگ‌ها و استوری‌هایی که در Jira به هر نفر assign شده‌اند و Done نیستند، حتی اگر در BackLog باشند، بدون توجه به اسپرینت. کارهای بدون assignee در این فهرست نیستند. کسی که در Jira کار دارد ولی هنوز نامش به یکی از نفرات برنامه وصل نشده، جدا آمده است.</p>
      </div>
    </div>
    <div class="people" id="people"></div>
  </section>

  <section class="block">
    <div class="block-head">
      <div>
        <h2>نقطهٔ تحویل هر اپیک</h2>
        <p class="lead">تاریخ‌ها بر اساس ترکیب تیمی که بالا انتخاب شده محاسبه شده‌اند. نوار هر ردیف بازهٔ کار روی آن اپیک را روی کل افق برنامه نشان می‌دهد.</p>
      </div>
    </div>
    <div class="tbl-scroll"><table id="epic-tbl"></table></div>
  </section>

  <section class="block">
    <h2>پیش از شروع</h2>
    <div class="notes" id="notes"></div>
  </section>

  <section class="block" id="sprint-sec">
    <div class="block-head">
      <div>
        <h2>اسپرینت پیشنهادی بعدی</h2>
        <p class="lead">اسپرینت‌ها ۱۰ روز کاری‌اند و از مرز اسپرینت‌های تیم پیروی می‌کنند. هر استوری در اسپرینتی قرار می‌گیرد که کارش در آن تمام می‌شود. ترتیب کارها از همان زمان‌بندی بالا می‌آید: اول مسیر بحرانی، و بین کارهای هم‌اولویت، اپیکی که کمتر کار در جریان دارد. به این ترتیب هر اسپرینت هم کوتاه‌ترین راه تا پایان پروژه را دنبال می‌کند، هم بیشترین اپیک را هم‌زمان جلو می‌برد.</p>
      </div>
      <div class="legend" id="legend-sp"></div>
    </div>
    <div id="sp-next"></div>
    <h3 class="sub-h">همهٔ اسپرینت‌ها تا پایان پروژه</h3>
    <p class="lead" style="font-size:13px">عدد هر خانه تعداد استوری‌هایی است که آن اپیک در آن اسپرینت تحویل می‌دهد. خانهٔ خط‌چین یعنی کار اپیک در آن اسپرینت در جریان است ولی استوری‌ای تمام نمی‌شود. ستون علامت‌خورده اسپرینت پیشنهادی بعدی است.</p>
    <div class="tbl-scroll"><table class="mx" id="sp-matrix"></table></div>
  </section>

  <details class="raw">
    <summary>جدول کامل زمان‌بندی کارها</summary>
    <div class="tbl-scroll"><table id="raw-tbl"></table></div>
  </details>
</div>
<div id="tip" hidden></div>`);
}
