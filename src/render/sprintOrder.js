// Order of work until the end of the running sprint: for every person the stories
// they should take, in order, in their parallel lanes, with dates. Built from
// engine.planSprintNow; also says which stories cannot be sequenced (they wait on
// something outside the sprint) and proves nothing overlaps.
import { findOverlaps } from '../engine.js';

/** @returns {string} inner HTML of #sp-order ('' without a running sprint) */
export function renderSprintOrder(R, N) {
  if (!N || !R.CURRENT_SPRINT) return '';
  const { esc, fa, kb, col, EP, JIRA, KEY_RE, dateAt, endDate, fmtD, personName, roleName } = R;
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener">${kb(k)}</a>` : kb(k));
  // the axis is the sprint plus a little slack, never the whole plan: work beyond it is clipped and counted
  const total = Math.max(1, N.horizon + Math.max(2, Math.ceil(N.horizon * 0.25)));
  const pct = (x) => `${Math.max(0, Math.min(100, (100 * x) / total)).toFixed(2)}%`;
  const items = [...N.sched.values()];
  const overflow = items.filter((v) => v.e > N.horizon + 1e-9);
  const storiesOver = new Set(overflow.map((v) => v.t.s.k));
  const planned = new Set(items.map((v) => v.t.s.k));
  const fits = [...planned].filter((k) => !storiesOver.has(k)).length;
  const overlaps = findOverlaps(N);
  const day = (x, end = false) => fmtD.format(end ? endDate(x) : dateAt(x));

  // who works on what: one card per person that has work, lanes inside
  const people = [];
  for (const r of ['BE', 'FE']) {
    const n = r === 'BE' ? R.state.be : R.state.fe;
    for (let i = 0; i < n; i++) {
      const mine = items.filter((v) => v.t.role === r && v.lane === i).sort((a, b) => a.s - b.s || a.slot - b.slot);
      if (mine.length) people.push({ r, i, mine });
    }
  }

  const tags = (v) => {
    const s = v.t.s;
    const out = [];
    if (N.crit.has(v.t.id)) out.push('<span class="tg crit">بحرانی</span>');
    if (s.f.includes('ip')) out.push('<span class="tg ip">در جریان</span>');
    if (v.e > N.horizon + 1e-9) out.push('<span class="tg ext">سرریز از اسپرینت</span>');
    if (s.f.includes('d')) out.push('<span class="tg dec">تصمیم باز</span>');
    if (v.t.role === 'FE') {
      const be = N.sched.get(s.k + ':BE');
      out.push(be ? '<span class="tg carry">با قرارداد API، بعد از نصف بک‌اند همین استوری</span>' : '<span class="tg goal">بک‌اند این استوری تمام شده</span>');
    }
    const after = [...new Set(v.t.preds.map((p) => p.t.s.k).filter((k) => k !== s.k))];
    if (after.length) out.push(`<span class="tg carry">بعد از ${after.map((k) => esc(k)).join('، ')}</span>`);
    return out.join(' ');
  };

  const card = ({ r, i, mine: all }) => {
    const mine = all.filter((v) => v.s < N.horizon - 1e-9); // started inside the sprint
    const later = all.length - mine.length;
    const lanes = [...new Set(mine.map((v) => v.slot))].sort((a, b) => a - b);
    const track = (slot) => `<div class="ord-lane">${mine.filter((v) => v.slot === slot).map((v) => {
      const c = col((EP[v.t.s.ep] || {}).t);
      return `<div class="ord-blk${v.e > N.horizon + 1e-9 ? ' over' : ''}${N.crit.has(v.t.id) ? ' crit' : ''}" style="--c:${c};inset-inline-start:${pct(v.s)};width:${pct(Math.min(v.e, total) - v.s)}" title="${esc(`${v.t.s.k} · ${v.t.s.title} · ${day(v.s)} تا ${day(v.e, true)}`)}">${esc(v.t.s.k)}</div>`;
    }).join('')}<div class="ord-end" style="inset-inline-start:${pct(N.horizon)}"><span>پایان اسپرینت</span></div></div>`;
    const list = mine.map((v, n) => `<li><div>${link(v.t.s.k)} ${esc(v.t.s.title)}</div>
      <div class="m2"><span>${fa(v.t.subs, 0)} sub-task ${r === 'BE' ? 'بک‌اند' : 'فرانت'}</span><span>${day(v.s)} تا ${day(v.e, true)}</span>${lanes.length > 1 ? `<span>خط ${fa(lanes.indexOf(v.slot) + 1, 0)}</span>` : ''}${tags(v)}</div></li>`).join('');
    return `<section class="ord-person"><header><span class="nm"><span class="role-dot ${r.toLowerCase()}"></span>${esc(personName(r, i))}</span><span>${esc(roleName(r))} · ${fa(mine.length, 0)} کار در این اسپرینت${lanes.length > 1 ? ` · ${fa(lanes.length, 0)} خط هم‌زمان` : ''}${later ? ` · ${fa(later, 0)} کار دیگر بعد از پایان اسپرینت شروع می‌شود` : ''}</span></header>
      ${mine.length ? `${lanes.map(track).join('')}<ol class="ord-list">${list}</ol>` : '<p class="lead" style="font-size:12.5px;margin:8px 12px">همهٔ کارهای این نفر بعد از پایان اسپرینت شروع می‌شود.</p>'}</section>`;
  };

  const blocked = N.blocked.map((b) => `<li>${link(b.s.k)} ${esc(b.s.title)} <span class="muted">← منتظر ${[...b.outside, ...b.ext].map((k) => esc(k)).join('، ')}</span></li>`).join('');

  return `<article class="ord">
    <div><h3>ترتیب پیشنهادی کار تا پایان اسپرینت جاری</h3>
    <p class="lead" style="font-size:13px">فقط کار باقی‌ماندهٔ استوری‌های همین اسپرینت، با همان نفرات و سرعت و هم‌زمانی هر نفر که بالای صفحه تنظیم شده. وابستگی‌ها رعایت می‌شود، فرانت وقتی نیمی از بک‌اند همان استوری تمام شد می‌تواند شروع کند، هر نفر فقط روی اپیک‌های خودش کار می‌کند و دو استوری از یک اپیک هم‌زمان روی یک نفر نمی‌نشیند. استوری‌های در جریان اول می‌آیند.</p></div>
    <div class="ord-stats">
      <span>روز کاری باقی‌مانده: <b>${fa(N.horizon, 0)}</b></span>
      <span>استوری برنامه‌ریزی‌شده: <b>${fa(planned.size, 0)}</b></span>
      <span>تا پایان اسپرینت تمام می‌شود: <b>${fa(fits, 0)}</b></span>
      <span>سرریز می‌کند: <b>${fa(storiesOver.size, 0)}</b></span>
      <span>منتظر وابستگی بیرونی: <b>${fa(N.blocked.length, 0)}</b></span>
      <span>تداخل: <b>${overlaps.length ? fa(overlaps.length, 0) + ' مورد' : 'ندارد ✓'}</b></span>
    </div>
    ${people.length ? people.map(card).join('') : '<p class="lead" style="font-size:13px">کار باقی‌مانده‌ای برای برنامه‌ریزی نیست.</p>'}
    ${blocked ? `<div><h4 style="margin:0 0 4px;font-size:13px">برنامه‌ریزی نشد: منتظر کار بیرون از این اسپرینت</h4><ul class="q-notes">${blocked}</ul></div>` : ''}
  </article>`;
}
