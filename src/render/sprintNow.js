// "Current sprint" card: what the running sprint holds and how far it is, from
// the issues Jira lists on it. Same look as the next-sprint proposal below it.
const PACE_TXT = { ahead: 'جلوتر از زمان', on: 'هم‌گام با زمان', behind: 'عقب‌تر از زمان' };
const CAT_TXT = { done: 'انجام‌شده', indeterminate: 'در جریان', new: 'شروع‌نشده' };

/** @returns {string} inner HTML of #sp-now ('' when no sprint is running) */
export function renderCurrentSprint(R) {
  const s = R.CURRENT_SPRINT;
  if (!s) return '';
  const { esc, fa, fmtD, JIRA, KEY_RE, EP, EP_BY_KEY, col } = R;
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener"><bdi class="k">${esc(k)}</bdi></a>` : `<bdi class="k">${esc(k)}</bdi>`);
  const day = (iso) => (iso && !Number.isNaN(new Date(iso)) ? fmtD.format(new Date(iso)) : '—');
  const bar = (done, total) => `<div class="b2"><i style="width:${total ? Math.min(100, Math.round((100 * done) / total)) : 0}%"></i></div>`;
  const stat = (v, l) => `<div><div class="v">${v}</div>${l}</div>`;
  const st = s.stories;

  const epicCard = (g) => {
    const code = g.key ? EP_BY_KEY[g.key] : null;
    const c = col(code ? EP[code].t : 0);
    const items = g.items.map((x) => `<li${x.cat === 'done' ? ' style="opacity:.55"' : ''}><div class="l1">${link(x.k)}<span${x.cat === 'done' ? ' style="text-decoration:line-through"' : ''}>${esc(x.title)}</span></div>
      <div class="m2"><span class="tg ${x.cat === 'done' ? 'goal' : x.cat === 'indeterminate' ? 'ip' : 'carry'}">${esc(CAT_TXT[x.cat] || x.status)}</span>${x.subs.total ? `<span>sub-task ${fa(x.subs.done, 0)} از ${fa(x.subs.total, 0)}</span>` : ''}${x.assignee ? `<span>${esc(x.assignee)}</span>` : ''}</div></li>`).join('');
    return `<div class="sp-ep" style="--c:${c}"><div class="sp-ep-h"><span class="sw" style="background:${c}"></span>${esc(g.name ?? 'سایر / بدون اپیک')} <small>${fa(g.done, 0)} از ${fa(g.items.length, 0)} استوری تمام شده</small></div><ul>${items}</ul></div>`;
  };

  return `<article class="sp-next" style="border-top-color:var(--good);margin-bottom:16px">
    <div class="sp-head">
      <div class="t">
        <div class="eyebrow">اسپرینت جاری</div>
        <h3>${esc(s.name)} · ${esc(day(s.start))} تا ${esc(day(s.end))}</h3>
        <p class="sp-goal">روز <b>${fa(s.days.elapsed, 0)}</b> از ${fa(s.days.total, 0)} روز کاری؛ <b>${fa(s.days.left, 0)}</b> روز کاری مانده.${s.pace ? ` پیشرفت کار (${fa(s.donePct, 0)}٪) <b>${PACE_TXT[s.pace]}</b> (${fa(s.timePct, 0)}٪ زمان گذشته).` : ''}</p>
      </div>
      <div class="sp-stats">
        ${stat(`${fa(st.done, 0)} <small>از ${fa(st.total, 0)}</small>`, 'استوری انجام‌شده')}
        ${stat(fa(st.doing, 0), 'استوری در جریان')}
        ${stat(fa(st.todo, 0), 'استوری شروع‌نشده')}
        ${stat(`${fa(s.subs.done, 0)} <small>از ${fa(s.subs.total, 0)}</small>`, 'sub-task انجام‌شده')}
      </div>
    </div>
    <div class="load"><span>زمان گذشته</span>${bar(s.days.elapsed, s.days.total)}</div>
    <div class="load"><span>استوری‌های انجام‌شده</span>${bar(st.done, st.total)}</div>
    <div class="load"><span>sub-task بک‌اند: ${fa(s.subs.be.done, 0)} از ${fa(s.subs.be.total, 0)} · فرانت: ${fa(s.subs.fe.done, 0)} از ${fa(s.subs.fe.total, 0)}${s.other.total ? ` · باگ و تسک دیگر: ${fa(s.other.done, 0)} از ${fa(s.other.total, 0)}` : ''}</span>${bar(s.subs.done, s.subs.total)}</div>
    <div class="sp-epics">${s.epics.map(epicCard).join('')}</div>
  </article>`;
}
