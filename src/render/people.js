// Open work per person: every non-Done issue with an assignee in Jira, grouped by the
// team member it belongs to. Pure: returns HTML, no DOM access.

/**
 * Each person is a collapsible card, closed by default. `open` holds the keys (data-pk) of the cards the
 * user opened, so a re-render (a control changed) keeps them open.
 * @param {Set<string>} [open]
 * @returns {string} inner HTML of #people
 */
export function renderPeople(R, open = new Set()) {
  const { EP, EP_BY_KEY, PEOPLE, KEY_RE, JIRA, state, esc, fa, kb, personName, parseDay, fmtD } = R;
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener">${kb(k)}</a>` : kb(k));
  const rows = R.ASSIGNED || [];
  const members = [];
  for (let i = 0; i < state.be; i++) members.push({ r: 'BE', i });
  for (let i = 0; i < state.fe; i++) members.push({ r: 'FE', i });
  PEOPLE.filter((p) => !members.some((m) => m.r === p.role && m.i === p.n - 1)).forEach((p) => members.push({ r: p.role, i: p.n - 1 }));
  const jiraOf = (m) => {
    const p = PEOPLE.find((x) => x.role === m.r && x.n === m.i + 1);
    return p ? (p.jira || []) : [];
  };
  // each Jira person gets one card: a later slot whose people are all shown already is skipped
  const mapped = new Set();
  const shown = [];
  for (const m of members) {
    const ids = jiraOf(m);
    if (ids.length && ids.every((x) => mapped.has(x))) continue;
    ids.forEach((x) => mapped.add(x));
    shown.push(m);
  }
  const prioRank = (p) => ({ Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }[p] ?? 5);
  const sort = (list) => list.slice().sort((x, y) => (x[4] === 'In Progress' ? 0 : 1) - (y[4] === 'In Progress' ? 0 : 1) || prioRank(x[8]) - prioRank(y[8]) || String(x[0]).localeCompare(String(y[0]), 'en', { numeric: true }));
  const epName = (k) => {
    const c = k && EP_BY_KEY[k];
    return c ? EP[c].n : '—';
  };
  const typeFa = (t) => ({ Bug: 'باگ', Task: 'تسک', 'Sub-task': 'sub-task', Story: 'استوری' }[t] || t);
  const table = (list) => '<div class="tbl-scroll" style="border:0;border-radius:0"><table><thead><tr><th>کلید</th><th>نوع</th><th>عنوان</th><th>وضعیت</th><th>اولویت</th><th>والد</th><th>اپیک</th><th>آخرین تغییر</th></tr></thead><tbody>' +
    sort(list).map((x) => `<tr><td>${link(x[0])}</td><td>${esc(typeFa(x[1]))}</td><td class="ttl">${esc(x[2])}</td><td>${x[4] === 'In Progress' ? `<span class="tg ip">${esc(x[3])}</span>` : esc(x[3])}</td><td>${x[8] === 'High' || x[8] === 'Highest' ? `<span class="tg ext">${esc(x[8])}</span>` : esc(x[8] || '—')}</td><td>${x[6] ? link(x[6]) : '—'}</td><td>${esc(epName(x[7]))}</td><td class="n">${x[9] && parseDay(x[9]) ? fmtD.format(parseDay(x[9])) : '—'}</td></tr>`).join('') + '</tbody></table></div>';
  const counts = (list) => {
    const c = {};
    list.forEach((x) => { c[x[1]] = (c[x[1]] || 0) + 1; });
    return Object.entries(c).map(([k, v]) => `<span><b>${fa(v)}</b> ${esc(typeFa(k))}</span>`).join('');
  };
  // title is trusted markup built by the caller below (names already escaped)
  const card = (pk, title, sub, list) => {
    const head = `<summary class="person-h"><span class="nm">${title}</span>${sub ? `<span>${esc(sub)}</span>` : ''}<span><b>${fa(list.length)}</b> کار باز</span>${counts(list)}</summary>`;
    return `<details class="person" data-pk="${esc(pk)}"${open.has(pk) ? ' open' : ''}>${head}${list.length ? table(list) : '<div class="empty">در Jira کار بازی به این نفر assign نشده است.</div>'}</details>`;
  };
  let h = shown.map((m) => {
    const ids = jiraOf(m);
    return card(`${m.r}:${m.i}`, `<span class="role-dot ${m.r.toLowerCase()}"></span>${esc(personName(m.r, m.i))}`, ids.length ? ids.join('، ') : 'هنوز به کسی در Jira وصل نشده', rows.filter((x) => ids.includes(x[5])));
  }).join('');
  const others = [...new Set(rows.map((x) => x[5]).filter((n) => n && !mapped.has(n)))];
  h += others.map((n) => card(`other:${n}`, `<span class="role-dot" style="background:var(--muted)"></span>${esc(n)}`, 'در Jira کار دارد ولی جزو نفرات برنامه نیست', rows.filter((x) => x[5] === n))).join('');
  return h;
}
