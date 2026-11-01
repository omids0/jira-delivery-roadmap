// Swimlane timeline: one lane group per developer (with parallel slots), recently
// closed stories, the decision-gate line and an epic-milestone row.
// Pure: returns HTML, no DOM access.
import { GATE } from '../engine.js';

const KEY_PREFIX_RE = /^[A-Z][A-Z0-9_]+-/;

/**
 * @returns {{ html: string, index: Object<string, object> }}  html belongs in #gantt; index maps bar id
 *   (task id, the bar's data-id) to its scheduled item, for the tooltip.
 */
export function renderGantt(R, P, crit) {
  const { state, EP, JIRA, esc, fa, col, personName, dateAt, wdIndex, parseDay, fmtD, fmtW } = R;
  const weekend = (R.ctx && R.ctx.weekend) || [4, 5];
  // the axis starts one workweek back so recent completions sit before the "today" line
  const HB = state.hist ? -5 : 0;
  const PX = Math.round(Math.max(28, Math.min(120, 2600 / Math.max(1, P.span - HB))));
  const W = (Math.ceil(P.span) - HB + 1) * PX;
  const X = (d) => (d - HB) * PX;
  const SLOT = 38;
  const rows = [];
  for (let i = 0; i < state.be; i++) rows.push({ r: 'BE', i, n: personName('BE', i) });
  for (let i = 0; i < state.fe; i++) rows.push({ r: 'FE', i, n: personName('FE', i) });
  const gridBg = 'background-image: repeating-linear-gradient(to left, var(--grid) 0 1px, transparent 1px ' + PX + 'px);';
  const step = PX >= 56 ? 1 : PX >= 34 ? 2 : 5;
  let h = `<div class="g-row g-head"><div class="g-lab">روز کاری</div><div class="g-track" style="width:${W}px">`;
  for (let d = HB; d < Math.ceil(P.span) + 1; d += step) {
    const dt = dateAt(d);
    // first day of the working week: the calendar day before it is a weekend day
    const sat = weekend.includes((dt.getDay() + 6) % 7) && !weekend.includes(dt.getDay());
    const rel = d - P.off;
    h += `<div class="tick" style="inset-inline-start:${X(d)}px;${sat ? 'border-inline-start-color:var(--fg2)' : ''}"><b>${rel >= 0 && rel % 10 === 0 ? 'اسپرینت ' + fa(rel / 10 + 1) : (rel < 0 ? 'گذشته' : sat ? 'شروع هفته' : '&nbsp;')}</b>${fmtW.format(dt)}</div>`;
  }
  h += `<div class="gate-line today" style="inset-inline-start:${X(P.off)}px"><span>امروز</span></div>`;
  h += `<div class="gate-line" style="inset-inline-start:${X(P.off + GATE)}px"><span>مهلت تصمیم‌های PO</span></div></div></div>`;

  // recent completions and ready-to-close stories, at their resolution day (older ones live in the project overview)
  const closed = P.list.filter((s) => s.done || s.rc)
    .map((s) => ({ s, x: s.done && s.res ? Math.min(wdIndex(parseDay(s.res)), P.off) : P.off }))
    .filter((c) => c.x >= HB).sort((a, b) => a.x - b.x);
  if (closed.length) {
    const rowsUsed = [];
    let pills = '';
    closed.forEach((c) => {
      const x = X(c.x) + 2;
      const w = 64;
      let r = 0;
      while (rowsUsed.some((u) => u.r === r && x < u.x + u.w + 4)) r++;
      rowsUsed.push({ r, x, w });
      const tip = `${c.s.k} · ${c.s.title} · ${c.s.done ? 'Done' + (c.s.res ? ' ' + fmtD.format(parseDay(c.s.res)) : '') : 'همهٔ sub-taskها Done، استوری باز است'}`;
      pills += `<a class="dpill ${c.s.rc ? 'rc' : ''}" href="${JIRA + esc(c.s.k)}" target="_blank" rel="noopener" title="${esc(tip)}" style="--c:${col(EP[c.s.ep].t)};inset-inline-start:${x}px;top:${6 + r * 26}px;width:${w}px">✓ ${esc(c.s.k.replace(KEY_PREFIX_RE, ''))}</a>`;
    });
    const hgt = 12 + (Math.max(...rowsUsed.map((u) => u.r)) + 1) * 26;
    h += `<div class="g-row"><div class="g-lab"><span class="done-ico" aria-hidden="true">✓</span><span>انجام‌شده<small>${fa(closed.length)} استوری</small></span></div><div class="g-track" style="width:${W}px;height:${hgt}px;${gridBg}">${pills}</div></div>`;
  }

  const all = [...P.sched.values()];
  rows.forEach((row) => {
    const items = all.filter((v) => v.t.role === row.r && v.lane === row.i);
    const slotBg = state.par > 1 ? `, repeating-linear-gradient(to bottom, transparent 0 ${SLOT - 1}px, var(--grid) ${SLOT - 1}px ${SLOT}px)` : '';
    h += `<div class="g-row"><div class="g-lab"><span class="role-dot ${row.r.toLowerCase()}"></span><span>${esc(row.n)}<small>${fa(Object.values(P.owners.own[row.r]).filter((i) => i === row.i).length)} اپیک${state.par > 1 ? ` · ${fa(state.par)} خط موازی` : ''}</small></span></div><div class="g-track" style="width:${W}px;height:${state.par * SLOT + 6}px;${gridBg.replace(/;$/, '')}${slotBg};background-position:0 3px">`;
    items.forEach((v) => {
      const s = v.t.s;
      const c = col(EP[s.ep].t);
      const cls = ['bar', s.f.includes('x') ? 'sugg' : '', s.f.includes('d') ? 'gate' : '', crit.has(v.t.id) ? 'crit' : ''].join(' ');
      const tag = s.f.includes('x') ? 'div' : 'a';
      const href = tag === 'a' ? ` href="${JIRA + esc(s.k)}" target="_blank" rel="noopener"` : ' tabindex="0"';
      h += `<${tag} class="${cls}"${href} data-id="${esc(v.t.id)}" style="--c:${c};top:${6 + v.slot * SLOT}px;inset-inline-start:${X(v.s) + 1}px;width:${Math.max(v.t.dur * PX - 3, 8)}px"><span class="bk">${esc(s.k.replace(KEY_PREFIX_RE, ''))}</span><span class="bt">${esc(s.title)}</span></${tag}>`;
    });
    h += '</div></div>';
  });

  // epic milestones
  const fin = R.eng.epicFinish(P);
  const placed = [];
  let miles = '';
  Object.entries(fin).filter(([ep]) => ep !== 'en').sort((a, b) => a[1].e - b[1].e).forEach(([ep, f]) => {
    const x = X(f.e);
    let top = 6;
    while (placed.some((p) => Math.abs(p.x - x) < 90 && p.top === top)) top += 24;
    placed.push({ x, top });
    miles += `<div class="mile" style="inset-inline-start:${x}px;top:${top}px;--c:${col(EP[ep].t)};transform:none"><span style="display:flex;align-items:center;gap:6px"><i></i>${esc(EP[ep].n)}</span></div>`;
  });
  const mh = Math.max(58, ...placed.map((p) => p.top + 26));
  h += `<div class="g-row mile-row"><div class="g-lab">تحویل اپیک</div><div class="g-track" style="width:${W}px;height:${mh}px;${gridBg}">${miles}</div></div>`;

  const index = Object.fromEntries(all.map((v) => [v.t.id, v]));
  return { html: h, index };
}
