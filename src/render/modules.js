// "Progress per module" bars and the full table. Same numbers as the dashboard report:
// Done / In Progress / Backlog per module, sorted by story count, with a totals row.
const GROUPING = {
  prefix: 'گروه‌بندی بر اساس پیشوند عنوان (US-XXX)',
  epic: 'گروه‌بندی بر اساس اپیک',
  none: 'همهٔ استوری‌ها در یک گروه (پیشوند عنوان یا اپیکی پیدا نشد)'
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n, total) => (total ? (100 * n) / total : 0);

/** @returns {{ note: string, bars: string, table: string }} contents of #mod-note, #mod-bars, #mod-tbl */
export function renderModules(R) {
  const M = R.MODULES;
  if (!M || !M.modules.length) return { note: '', bars: '<p class="lead" style="font-size:13px">استوری‌ای پیدا نشد.</p>', table: '' };
  const num = (n) => String(Math.round(n));
  const row = (m) => {
    const d = pct(m.done, m.total);
    const w = pct(m.inProgress, m.total);
    const b = pct(m.backlog, m.total);
    return `<div class="module-row">
      <div><div class="module-name">${esc(m.label)}</div><span class="module-code">${esc(m.id)} · ${m.total}</span></div>
      <div class="bar-track" role="img" aria-label="${esc(m.label)}: ${num(d)}٪ Done، ${num(w)}٪ In Progress، ${num(b)}٪ Backlog">
        <span class="seg done" style="width:${d}%"></span><span class="seg wip" style="width:${w}%"></span><span class="seg backlog" style="width:${b}%"></span>
      </div>
      <div class="module-pct"><b>${num(d)}%</b> / ${num(w)}% / ${num(b)}%</div>
    </div>`;
  };
  const t = M.totals;
  const trow = (m) => `<tr><td>${esc(m.label)}</td><td class="n"><span class="pill d">${m.done}</span></td><td class="n"><span class="pill w">${m.inProgress}</span></td><td class="n"><span class="pill b">${m.backlog}</span></td><td class="n">${m.total}</td><td class="n">${num(pct(m.done, m.total))}%</td><td class="n">${num(pct(m.inProgress, m.total))}%</td><td class="n">${num(pct(m.backlog, m.total))}%</td></tr>`;
  return {
    note: `مرتب‌شده بر اساس تعداد استوری؛ ${GROUPING[M.mode] || GROUPING.none}. استوری وقتی Done حساب می‌شود که خودش Done باشد، یا در جریان باشد و همهٔ sub-taskهای بک‌اند و فرانتش Done شده باشد.`,
    bars: `<div class="modules">${M.modules.map(row).join('')}</div>`,
    table: `<thead><tr><th>ماژول</th><th class="n">Done</th><th class="n">In&nbsp;Progress</th><th class="n">Backlog</th><th class="n">جمع</th><th class="n">٪Done</th><th class="n">٪In&nbsp;Progress</th><th class="n">٪Backlog</th></tr></thead>
    <tbody>${M.modules.map(trow).join('')}<tr class="sum"><td>جمع</td><td class="n">${t.done}</td><td class="n">${t.inProgress}</td><td class="n">${t.backlog}</td><td class="n">${t.total}</td><td class="n">${num(pct(t.done, t.total))}%</td><td class="n">${num(pct(t.inProgress, t.total))}%</td><td class="n">${num(pct(t.backlog, t.total))}%</td></tr></tbody>`
  };
}
