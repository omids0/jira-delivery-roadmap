// "Front-end's turn": stories whose back-end sub-tasks are ALL Done in Jira while
// front-end sub-tasks are still open. That is the main list: nothing in it is a guess.
// A second, collapsed list holds the stories where the back-end is more than half done
// (the front-end could start from the API contract), kept apart because it is not certain.
// Pure: HTML string.
const MAX_ROWS = 60;

/**
 * @returns {{ ready: object[], contract: object[] }}
 *   ready    = back-end sub-tasks exist and every one is Done; front-end has open sub-tasks
 *   contract = back-end more than half Done, not finished
 * A story without back-end sub-tasks is in neither: "back-end done" cannot be proven for it.
 */
export function feCandidates(R, P) {
  const by = Object.fromEntries(P.list.map((s) => [s.k, s]));
  const inSprint = new Set((R.CURRENT_SPRINT?.epics || []).flatMap((g) => g.items.map((x) => x.k)));
  const out = { ready: [], contract: [] };
  for (const s of P.list) {
    if (s.done || s.rc || !(s.sfe > 0)) continue;
    const beTotal = s.subs?.be?.total || 0;
    if (!beTotal) continue;
    const feTotal = s.subs?.fe?.total || 0;
    const beDone = beTotal - s.sbe;
    const kind = s.sbe === 0 ? 'ready' : beDone / beTotal > 0.5 ? 'contract' : null;
    if (!kind) continue;
    out[kind].push({
      s, beTotal, beDone, feTotal, feDone: feTotal ? feTotal - s.sfe : 0, sprint: inSprint.has(s.k),
      waits: s.deps.filter((d) => by[d] && !by[d].done)
    });
  }
  const order = (a, b) => (a.waits.length ? 1 : 0) - (b.waits.length ? 1 : 0) || (b.sprint ? 1 : 0) - (a.sprint ? 1 : 0) || (a.s.rank || 0) - (b.s.rank || 0) || a.s.k.localeCompare(b.s.k, 'en', { numeric: true });
  out.ready.sort(order);
  out.contract.sort(order);
  return out;
}

/** @returns {string} inner HTML of #fe-ready */
export function renderFeReady(R, P) {
  const { esc, fa, kb, JIRA, KEY_RE, EP } = R;
  const { ready, contract } = feCandidates(R, P);
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener">${kb(k)}</a>` : kb(k));
  const feSubs = (list) => list.reduce((a, x) => a + x.s.sfe, 0);

  const row = (x, kind) => {
    const s = x.s;
    const tags = [
      kind === 'ready' ? '<span class="tg goal">همهٔ بک‌اند Done</span>' : '<span class="tg ip">شروع با قرارداد API</span>',
      x.sprint ? '<span class="tg carry">در اسپرینت جاری</span>' : '',
      s.f.includes('ip') ? '<span class="tg ip">در جریان</span>' : '',
      s.f.includes('d') ? '<span class="tg dec">تصمیم باز</span>' : '',
      x.waits.length ? `<span class="tg ext">منتظر ${x.waits.map((k) => esc(k)).join('، ')}</span>` : ''
    ].join(' ');
    const fe = `${fa(s.sfe, 0)} باز${x.feTotal ? ` از ${fa(x.feTotal, 0)}` : ''}`;
    return `<tr><td>${link(s.k)}</td><td class="ttl">${esc(s.title)}</td><td>${esc((EP[s.ep] || {}).n || '')}</td><td class="n">${fa(x.beDone, 0)} از ${fa(x.beTotal, 0)} Done</td><td class="n">${fe}</td><td>${tags}</td></tr>`;
  };
  const table = (list, kind) => `<div class="tbl-scroll"><table><thead><tr><th>استوری</th><th>عنوان</th><th>اپیک</th><th>بک‌اند</th><th>فرانت</th><th>وضعیت</th></tr></thead><tbody>
    ${list.slice(0, MAX_ROWS).map((x) => row(x, kind)).join('')}${list.length > MAX_ROWS ? `<tr><td colspan="6">و ${fa(list.length - MAX_ROWS, 0)} مورد دیگر</td></tr>` : ''}
  </tbody></table></div>`;

  const main = ready.length
    ? `<p class="lead" style="font-size:13px"><b>${fa(ready.length, 0)}</b> استوری، <b>${fa(feSubs(ready), 0)}</b> sub-task فرانت: همهٔ sub-taskهای بک‌اند این استوری‌ها در Jira Done شده است.</p>${table(ready, 'ready')}`
    : '<p class="lead" style="font-size:13px">فعلاً استوری‌ای نیست که همهٔ sub-taskهای بک‌اندش Done شده باشد و کار فرانتش مانده باشد.</p>';
  const rest = contract.length
    ? `<details class="own" style="margin-top:12px"><summary>قابل شروع با قرارداد API، بک‌اند هنوز تمام نشده <span class="own-sum">${fa(contract.length, 0)} استوری، ${fa(feSubs(contract), 0)} sub-task فرانت</span></summary><div class="own-body">${table(contract, 'contract')}</div></details>`
    : '';
  return main + rest;
}
