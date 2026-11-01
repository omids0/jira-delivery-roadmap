// Epic ownership table: which developer owns each epic's backend / front-end work.
// Pure: returns HTML / text, no DOM access. Interaction lives in src/browser/owners-ui.js.

/**
 * @returns {{ table: string, summary: string, summaryHtml: string }}
 *   table: inner HTML of #own-tbl (thead + tbody);
 *   summary: plain text for #own-sum (set it with textContent), summaryHtml: the same text HTML-escaped.
 */
export function renderOwners(R, P) {
  const { EP, EP_ORDER, state, esc, fa, col, roleName, personName } = R;
  const { own, need, load } = P.owners;
  const n = { BE: state.be, FE: state.fe };
  const manualOwn = state.own || { BE: {}, FE: {} };
  const eps = EP_ORDER.filter((ep) => need.BE[ep] != null || need.FE[ep] != null);
  const cell = (r, ep) => {
    if (need[r][ep] == null) return '<span class="muted">—</span>';
    if (n[r] <= 1) return esc(personName(r, 0));
    const key = EP[ep].k;
    const manual = !!key && manualOwn[r] && manualOwn[r][key] != null && manualOwn[r][key] < n[r];
    return `<select data-r="${r}" data-ep="${esc(ep)}" aria-label="مسئول ${roleName(r)} ${esc(EP[ep].n)}">${Array.from({ length: n[r] }, (_, i) => `<option value="${i}"${i === own[r][ep] ? ' selected' : ''}>${esc(personName(r, i))}</option>`).join('')}</select>${manual ? '' : '<small class="auto">خودکار</small>'}`;
  };
  const table = '<thead><tr><th>اپیک</th><th>sub-task بک‌اند باقی</th><th>مسئول بک‌اند</th><th>sub-task فرانت باقی</th><th>مسئول فرانت</th></tr></thead><tbody>' +
    eps.map((ep) => `<tr><td><span class="ep-name"><i class="sw" style="background:${col(EP[ep].t)}"></i>${esc(EP[ep].n)}</span></td><td class="n">${need.BE[ep] != null ? fa(need.BE[ep]) : '—'}</td><td>${cell('BE', ep)}</td><td class="n">${need.FE[ep] != null ? fa(need.FE[ep]) : '—'}</td><td>${cell('FE', ep)}</td></tr>`).join('') + '</tbody>';
  const sum = (r) => load[r].map((v, i) => `${personName(r, i)}: ${fa(Math.round(v))} sub-task در ${fa(Object.values(own[r]).filter((x) => x === i).length)} اپیک`).join(' · ');
  const summary = `${sum('BE')} | ${sum('FE')}`;
  return { table, summary, summaryHtml: esc(summary) };
}
