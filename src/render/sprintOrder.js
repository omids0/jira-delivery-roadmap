// Order of work until the end of the running sprint, by ROLE (back-end / front-end),
// not by person. For every story it says what it can run alongside and what it must wait
// for (dependency, API contract, same epic, no free line, open decision). Built from
// engine.planSprintNow; stories that wait on work outside the sprint are listed apart.
import { findOverlaps } from '../engine.js';

const eq = (a, b) => Math.abs(a - b) < 1e-6;
const overlap = (a, b) => a.s < b.e - 1e-9 && b.s < a.e - 1e-9;

/**
 * For each scheduled task: which tasks of the same role run at the same time (`parallelWith`)
 * and, when it does not start at once, what it waits for (`waits`).
 * reason: 'dep' (finished story it depends on) | 'contract' (half of the same story's back-end)
 *       | 'decision' (open decision gate) | 'epic' (same epic, one at a time) | 'capacity' (all lines busy)
 * @returns {Map<string, { parallelWith: string[], waits: null | { key: string, reason: string } }>}
 */
export function describeOrder(N) {
  const items = [...N.sched.values()];
  const out = new Map();
  for (const v of items) {
    const parallelWith = [...new Set(items
      .filter((o) => o !== v && o.t.role === v.t.role && o.t.s.k !== v.t.s.k && overlap(o, v))
      .map((o) => o.t.s.k))];
    let waits = null;
    if (v.s > 1e-9) {
      const pred = v.t.preds
        .map((p) => ({ p, pd: N.sched.get(p.t.id) }))
        .find(({ p, pd }) => pd && (p.type === 'fs' ? eq(pd.e, v.s) : eq(pd.s + 0.5 * p.t.dur, v.s) || eq(pd.e + 0.1 - v.t.dur, v.s)));
      if (pred) waits = { key: pred.p.t.s.k, reason: pred.p.type === 'c' ? 'contract' : 'dep' };
      else if (v.t.release > 1e-9 && eq(v.s, v.t.release)) waits = { key: v.t.s.k, reason: 'decision' };
      else {
        const sameEpic = items.find((o) => o.t.role === v.t.role && o.lane === v.lane && o.t.s.ep === v.t.s.ep && o !== v && eq(o.e, v.s));
        const sameLine = items.find((o) => o.t.role === v.t.role && o.lane === v.lane && o.slot === v.slot && o !== v && eq(o.e, v.s));
        if (sameEpic) waits = { key: sameEpic.t.s.k, reason: 'epic' };
        else if (sameLine) waits = { key: sameLine.t.s.k, reason: 'capacity' };
      }
    }
    out.set(v.t.id, { parallelWith, waits });
  }
  return out;
}

const WAIT_TXT = {
  dep: (k) => `منتظر ${k} (وابستگی)`,
  contract: (k) => `بعد از نصف بک‌اند ${k} (قرارداد API)`,
  decision: () => 'منتظر تصمیم باز',
  epic: (k) => `بعد از ${k} (هم‌اپیک؛ دو استوری یک اپیک هم‌زمان نمی‌شود)`,
  capacity: (k) => `بعد از ${k} (همهٔ خط‌ها پر است)`
};

/** @returns {string} inner HTML of #sp-order ('' without a running sprint) */
export function renderSprintOrder(R, N) {
  if (!N || !R.CURRENT_SPRINT) return '';
  const { esc, fa, kb, col, EP, JIRA, KEY_RE, dateAt, endDate, fmtD, roleName } = R;
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener">${kb(k)}</a>` : kb(k));
  // the axis is the sprint plus a little slack, never the whole plan: work beyond it is clipped and counted
  const total = Math.max(1, N.horizon + Math.max(2, Math.ceil(N.horizon * 0.25)));
  const pct = (x) => `${Math.max(0, Math.min(100, (100 * x) / total)).toFixed(2)}%`;
  const items = [...N.sched.values()];
  const rel = describeOrder(N);
  const overflow = items.filter((v) => v.e > N.horizon + 1e-9);
  const storiesOver = new Set(overflow.map((v) => v.t.s.k));
  const planned = new Set(items.map((v) => v.t.s.k));
  const fits = [...planned].filter((k) => !storiesOver.has(k)).length;
  const overlaps = findOverlaps(N);
  const day = (x, end = false) => fmtD.format(end ? endDate(x) : dateAt(x));
  const inSprintNow = (v) => v.s < N.horizon - 1e-9;

  const count = (reason) => items.filter((v) => inSprintNow(v) && rel.get(v.t.id).waits?.reason === reason).length;
  const parallelNow = items.filter((v) => inSprintNow(v) && rel.get(v.t.id).parallelWith.length).length;

  const tags = (v) => {
    const s = v.t.s;
    const r = rel.get(v.t.id);
    const out = [];
    if (N.crit.has(v.t.id)) out.push('<span class="tg crit">بحرانی</span>');
    if (s.f.includes('ip')) out.push('<span class="tg ip">در جریان</span>');
    if (v.e > N.horizon + 1e-9) out.push('<span class="tg ext">سرریز از اسپرینت</span>');
    if (r.parallelWith.length) out.push(`<span class="tg goal">هم‌زمان با ${r.parallelWith.slice(0, 4).map((k) => esc(k)).join('، ')}${r.parallelWith.length > 4 ? ` و ${fa(r.parallelWith.length - 4, 0)} مورد دیگر` : ''}</span>`);
    if (r.waits) out.push(`<span class="tg ${r.waits.reason === 'decision' ? 'dec' : 'carry'}">${esc(WAIT_TXT[r.waits.reason](r.waits.key))}</span>`);
    else if (v.s <= 1e-9) out.push('<span class="tg goal">شروع از همین الان</span>');
    if (v.t.role === 'FE' && !N.sched.get(s.k + ':BE') && !r.waits) out.push('<span class="tg goal">بک‌اند این استوری تمام شده</span>');
    return out.join(' ');
  };

  const card = (r) => {
    const all = items.filter((v) => v.t.role === r).sort((a, b) => a.s - b.s || a.lane - b.lane || a.slot - b.slot);
    if (!all.length) return '';
    const mine = all.filter(inSprintNow);
    const later = all.length - mine.length;
    // a "line" is one place where a story can run; the lines of all people of the role are numbered together
    const lineKeys = [...new Set(all.map((v) => `${v.lane}:${v.slot}`))].sort((a, b) => {
      const [al, as] = a.split(':').map(Number);
      const [bl, bs] = b.split(':').map(Number);
      return al - bl || as - bs;
    });
    const lineOf = (v) => lineKeys.indexOf(`${v.lane}:${v.slot}`);
    const usedLines = [...new Set(mine.map(lineOf))].sort((a, b) => a - b);
    const heads = N.pars[r].length;
    const capacity = N.pars[r].reduce((a, b) => a + b, 0);
    const track = (line) => `<div class="ord-lane"><span class="ord-lab">خط ${fa(line + 1, 0)}</span>${mine.filter((v) => lineOf(v) === line).map((v) => {
      const c = col((EP[v.t.s.ep] || {}).t);
      return `<div class="ord-blk${v.e > N.horizon + 1e-9 ? ' over' : ''}${N.crit.has(v.t.id) ? ' crit' : ''}" style="--c:${c};inset-inline-start:${pct(v.s)};width:${pct(Math.min(v.e, total) - v.s)}" title="${esc(`${v.t.s.k} · ${v.t.s.title} · ${day(v.s)} تا ${day(v.e, true)}`)}">${esc(v.t.s.k)}</div>`;
    }).join('')}<div class="ord-end" style="inset-inline-start:${pct(N.horizon)}"><span>پایان اسپرینت</span></div></div>`;
    const list = mine.map((v) => `<li><div>${link(v.t.s.k)} ${esc(v.t.s.title)}</div>
      <div class="m2"><span>${fa(v.t.subs, 0)} sub-task</span><span>${day(v.s)} تا ${day(v.e, true)}</span><span>خط ${fa(lineOf(v) + 1, 0)}</span>${tags(v)}</div></li>`).join('');
    return `<section class="ord-person"><header><span class="nm"><span class="role-dot ${r.toLowerCase()}"></span>${esc(roleName(r))}</span><span>${fa(mine.length, 0)} کار در این اسپرینت · ${fa(heads, 0)} نفر، تا ${fa(capacity, 0)} استوری هم‌زمان${later ? ` · ${fa(later, 0)} کار دیگر بعد از پایان اسپرینت شروع می‌شود` : ''}</span></header>
      ${mine.length ? `${usedLines.map(track).join('')}<ol class="ord-list">${list}</ol>` : '<p class="lead" style="font-size:12.5px;margin:8px 12px">همهٔ کارهای این نقش بعد از پایان اسپرینت شروع می‌شود.</p>'}</section>`;
  };

  const blocked = N.blocked.map((b) => `<li>${link(b.s.k)} ${esc(b.s.title)} <span class="muted">← منتظر ${[...b.outside, ...b.ext].map((k) => esc(k)).join('، ')}</span></li>`).join('');
  const body = ['BE', 'FE'].map(card).join('');

  return `<article class="ord">
    <div><h3>ترتیب پیشنهادی کار تا پایان اسپرینت جاری</h3>
    <p class="lead" style="font-size:13px">فقط کار باقی‌ماندهٔ استوری‌های همین اسپرینت، جدا برای بک‌اند و فرانت، با نفرات و سرعت و هم‌زمانی بالای صفحه. هر «خط» جایی است که یک استوری روی آن پیش می‌رود. برچسب سبز یعنی با آن استوری‌ها <b>هم‌زمان</b> پیش می‌رود؛ برچسب خاکستری یعنی باید <b>منتظر</b> بماند و دلیلش نوشته شده: وابستگی، نصف بک‌اند همان استوری (فرانت)، هم‌اپیک بودن (دو استوری از یک اپیک هم‌زمان نمی‌شوند)، پر بودن همهٔ خط‌ها، یا تصمیم باز. استوری‌های در جریان اول می‌آیند.</p></div>
    <div class="ord-stats">
      <span>روز کاری باقی‌مانده: <b>${fa(N.horizon, 0)}</b></span>
      <span>استوری برنامه‌ریزی‌شده: <b>${fa(planned.size, 0)}</b></span>
      <span>تا پایان اسپرینت تمام می‌شود: <b>${fa(fits, 0)}</b></span>
      <span>سرریز می‌کند: <b>${fa(storiesOver.size, 0)}</b></span>
      <span>هم‌زمان‌پذیر: <b>${fa(parallelNow, 0)}</b> کار</span>
      <span>منتظر وابستگی: <b>${fa(count('dep') + count('contract'), 0)}</b></span>
      <span>منتظر هم‌اپیک: <b>${fa(count('epic'), 0)}</b></span>
      <span>منتظر خط خالی: <b>${fa(count('capacity'), 0)}</b></span>
      <span>منتظر وابستگی بیرونی: <b>${fa(N.blocked.length, 0)}</b></span>
      <span>تداخل: <b>${overlaps.length ? fa(overlaps.length, 0) + ' مورد' : 'ندارد ✓'}</b></span>
    </div>
    ${body || '<p class="lead" style="font-size:13px">کار باقی‌مانده‌ای برای برنامه‌ریزی نیست.</p>'}
    ${blocked ? `<div><h4 style="margin:0 0 4px;font-size:13px">برنامه‌ریزی نشد: منتظر کار بیرون از این اسپرینت</h4><ul class="q-notes">${blocked}</ul></div>` : ''}
  </article>`;
}
