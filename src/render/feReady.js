// "Front-end's turn": stories whose back-end work is finished (or half done, enough
// to start from the API contract) while front-end sub-tasks are still open. The rest
// of the page is driven by the back-end chain; this one tells the front-end what to
// pick up now. Pure: HTML string.
const MAX_ROWS = 60;

/** @returns {{ ready: object[], contract: object[] }} stories grouped by how soon the front-end can start */
export function feCandidates(R, P) {
  const by = Object.fromEntries(P.list.map((s) => [s.k, s]));
  const inSprint = new Set((R.CURRENT_SPRINT?.epics || []).flatMap((g) => g.items.map((x) => x.k)));
  const out = { ready: [], contract: [] };
  for (const s of P.list) {
    if (s.done || s.rc || !(s.sfe > 0)) continue;
    const beTotal = s.subs?.be?.total || 0;
    const feTotal = s.subs?.fe?.total || 0;
    const beDone = beTotal ? beTotal - s.sbe : 0;
    const kind = s.sbe === 0 ? 'ready' : beTotal > 0 && beDone / beTotal >= 0.5 ? 'contract' : null;
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
  if (!ready.length && !contract.length) {
    return '<p class="lead" style="font-size:13px">فعلاً استوری‌ای نیست که کار بک‌اندش تمام (یا بیش از نصف) شده باشد و کار فرانتش مانده باشد.</p>';
  }
  const row = (x, kind) => {
    const s = x.s;
    const tags = [
      kind === 'ready' ? '<span class="tg goal">بک‌اند تمام شد، فرانت شروع کند</span>' : '<span class="tg ip">شروع با قرارداد API</span>',
      x.sprint ? '<span class="tg carry">در اسپرینت جاری</span>' : '',
      s.f.includes('ip') ? '<span class="tg ip">در جریان</span>' : '',
      s.f.includes('d') ? '<span class="tg dec">تصمیم باز</span>' : '',
      x.waits.length ? `<span class="tg ext">منتظر ${x.waits.map((k) => esc(k)).join('، ')}</span>` : ''
    ].join(' ');
    const be = x.beTotal ? `${fa(x.beDone, 0)} از ${fa(x.beTotal, 0)} تمام` : 'کار بک‌اند ندارد';
    const fe = `${fa(s.sfe, 0)} باز${x.feTotal ? ` از ${fa(x.feTotal, 0)}` : ''}`;
    return `<tr><td>${link(s.k)}</td><td class="ttl">${esc(s.title)}</td><td>${esc((EP[s.ep] || {}).n || '')}</td><td class="n">${be}</td><td class="n">${fe}</td><td>${tags}</td></tr>`;
  };
  const group = (list, kind, title) => (list.length
    ? `<tr class="sum"><td colspan="6">${title}: <b>${fa(list.length, 0)}</b> استوری، <b>${fa(feSubs(list), 0)}</b> sub-task فرانت</td></tr>${list.slice(0, MAX_ROWS).map((x) => row(x, kind)).join('')}${list.length > MAX_ROWS ? `<tr><td colspan="6">و ${fa(list.length - MAX_ROWS, 0)} مورد دیگر</td></tr>` : ''}`
    : '');
  return `<div class="tbl-scroll"><table><thead><tr><th>استوری</th><th>عنوان</th><th>اپیک</th><th>بک‌اند</th><th>فرانت</th><th>وضعیت</th></tr></thead><tbody>
    ${group(ready, 'ready', 'بک‌اند تمام شده و فرانت مانده')}
    ${group(contract, 'contract', 'بیش از نصف بک‌اند تمام شده (قابل شروع با قرارداد API)')}
  </tbody></table></div>`;
}
