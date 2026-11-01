// Epic delivery table: open work, remaining sub-tasks, start / finish and a span bar.
// Pure: returns HTML, no DOM access.

/** @returns {string} inner HTML of the #epic-tbl table (thead + tbody) */
export function renderEpics(R, P) {
  const { EP, JIRA, esc, fa, col, kb, dateAt, endDate, fmtD } = R;
  const fin = R.eng.epicFinish(P);
  const span = P.span;
  const closedBy = {};
  P.list.filter((s) => s.done || s.rc).forEach((s) => { closedBy[s.ep] = (closedBy[s.ep] || 0) + 1; });
  Object.keys(closedBy).forEach((ep) => {
    if (!fin[ep]) fin[ep] = { s: null, e: null, be: 0, fe: 0, n: new Set(), allDone: true };
  });
  const rows = Object.entries(fin).sort((a, b) => (a[1].e == null ? -1 : a[1].e) - (b[1].e == null ? -1 : b[1].e));
  return '<thead><tr><th>اپیک</th><th>کار</th><th>sub-task بک‌اند</th><th>sub-task فرانت</th><th>شروع</th><th>تحویل</th><th class="span-cell">بازه روی افق برنامه</th></tr></thead><tbody>' +
    rows.map(([ep, f]) => {
      const e = EP[ep];
      return `<tr><td><span class="ep-name"><i class="sw ${e.t ? '' : 'hatch'}" style="background:${e.t ? col(e.t) : ''}"></i>${esc(e.n)}${e.k ? ` <a href="${JIRA + esc(e.k)}" target="_blank" rel="noopener">${kb(e.k)}</a>` : ''}</span></td>
        <td class="n">${fa(f.n.size)} باز${closedBy[ep] ? ` · ${fa(closedBy[ep])} ✓` : ''}</td><td class="n">${fa(f.be)}</td><td class="n">${fa(f.fe)}</td>
        ${f.allDone ? '<td>—</td><td><span class="pill good">تمام شد</span></td><td class="span-cell"></td></tr>' : `
        <td class="n">${fmtD.format(dateAt(f.s))}</td><td class="n"><b>${fmtD.format(endDate(f.e))}</b></td>
        <td class="span-cell"><div class="span"><i style="--c:${col(e.t)};inset-inline-start:${100 * f.s / span}%;width:${Math.max(1.5, 100 * (f.e - f.s) / span)}%"></i></div></td></tr>`}`;
    }).join('') + '</tbody>';
}
