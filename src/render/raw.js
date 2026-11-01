// Full schedule table (DOM id: raw-tbl, a <table>). Pure: (R, P, crit) => inner HTML string.
export function renderRaw(R, P, crit) {
  const { fmtD, dateAt, endDate, esc, kb, fa, personName, EP } = R;
  const rows = [...P.sched.values()].sort((a, b) => a.s - b.s || a.t.role.localeCompare(b.t.role));
  return `<thead><tr><th>شروع</th><th>پایان</th><th>نقش</th><th>کلید</th><th>عنوان</th><th>اپیک</th><th>sub-task</th><th>مدت</th><th>بحرانی</th></tr></thead><tbody>` +
    rows.map((v) => `<tr><td class="n">${fmtD.format(dateAt(v.s))}</td><td class="n">${fmtD.format(endDate(v.e))}</td><td>${esc(personName(v.t.role, v.lane))} · خط ${fa(v.slot + 1)}</td><td>${kb(v.t.s.k)}</td><td>${esc(v.t.s.title)}</td><td>${esc(EP[v.t.s.ep].n)}</td><td class="n">${fa(v.t.subs)}</td><td class="n">${fa(v.t.dur, 2)} روز</td><td>${crit.has(v.t.id) ? 'بله' : ''}</td></tr>`).join('') + `</tbody>`;
}
