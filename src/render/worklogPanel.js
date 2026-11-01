// "Estimate from logged time" panel of the sprint proposal: what the past worklogs say about
// hours per sub-task and hours per day, the pace that gives, and how it compares with the
// pace counted from sprint velocity. Pure: HTML string.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** @returns {string} inner HTML of #sp-wl */
export function renderWorklogPanel(R) {
  const W = R.WORKLOG;
  const { fa, fmtD, parseDay, PACE, roleName } = R;
  const hint = (t) => `<p class="lead" style="font-size:13px">${t}</p>`;
  if (!W) return hint('ورک‌لاگی از Jira خوانده نشد (ثبت زمان در این پروژه روشن نیست، یا دسترسی خواندن ندارید). پیشنهاد اسپرینت با سرعت اسپرینت‌های قبل ساخته می‌شود.');
  const day = (iso) => (parseDay(iso) ? fmtD.format(parseDay(iso)) : esc(iso));
  const h = (x) => `${fa(x, 1)} ساعت`;
  const range = `${day(W.window.since)} تا ${day(W.window.until)}`;
  if (!W.pace) {
    return hint(`در بازهٔ ${range} ورک‌لاگ کافی پیدا نشد: برای هر نقش دست‌کم ${fa(W.minSubtasks, 0)} sub-task بسته‌شده با زمان ثبت‌شده و نفرانی با دست‌کم ${fa(W.minDays, 0)} روز ثبت زمان لازم است (الان: بک‌اند ${fa(W.perSubtask.be.n, 0)} sub-task، فرانت ${fa(W.perSubtask.fe.n, 0)} sub-task). پیشنهاد اسپرینت با سرعت اسپرینت‌های قبل ساخته می‌شود.`);
  }

  const role = (r, R2) => {
    const s = W.perSubtask[r];
    const wl = W.pace[R2];
    const vel = PACE.avg[R2];
    const diff = wl && vel ? Math.round((100 * (wl - vel)) / vel) : null;
    return `<tr><td>${esc(roleName(R2))}</td>
      <td class="n">${fa(s.n, 0)}</td><td class="n">${s.n ? h(s.avg) : '—'}<span class="muted"> (میانه ${s.n ? h(s.median) : '—'})</span></td>
      <td class="n">${fa(W.roles[r].d, 0)} نفر-روز</td><td class="n">${W.roles[r].d ? h(W.perDay[r]) : '—'}</td>
      <td class="n"><b>${wl ? fa(wl, 1) : '—'}</b></td><td class="n">${fa(vel, 1)}</td>
      <td class="n">${diff === null ? '—' : `${diff > 0 ? '+' : ''}${fa(diff, 0)}٪`}</td></tr>`;
  };
  const people = Object.entries(W.people).sort((a, b) => b[1].hours - a[1].hours)
    .map(([name, p]) => `<tr><td>${esc(name)}</td><td>${esc(roleName(p.role.toUpperCase()))}</td><td class="n">${h(p.hours)}</td><td class="n">${fa(p.days, 0)}</td><td class="n">${h(p.perDay)}</td><td class="n">${p.pace ? fa(p.pace, 1) : '—'}</td></tr>`).join('');

  return `<p class="lead" style="font-size:13px">از ورک‌لاگ‌های ثبت‌شده در بازهٔ ${range} (اسپرینت‌های بسته‌شدهٔ اخیر): میانگین زمانی که روی هر sub-task بسته‌شده صرف شده، تقسیم بر ساعتی که هر نفر در روزهای ثبت‌شده‌اش لاگ می‌کند، سرعت «sub-task در روز» را می‌دهد. ساعت‌های روزِ تعطیل حساب نمی‌شود.${W.partial ? ' برای یکی از نقش‌ها داده کافی نبود؛ سرعت آن نقش از اسپرینت‌های قبل گرفته می‌شود.' : ''}</p>
  <div class="tbl-scroll"><table><thead><tr><th>نقش</th><th>sub-task بررسی‌شده</th><th>میانگین زمان هر sub-task</th><th>زمان ثبت‌شده</th><th>ساعت در روز هر نفر</th><th>سرعت از ورک‌لاگ</th><th>سرعت از اسپرینت‌ها</th><th>اختلاف</th></tr></thead><tbody>${role('be', 'BE')}${role('fe', 'FE')}</tbody></table></div>
  ${people ? `<div class="tbl-scroll" style="margin-top:10px"><table><thead><tr><th>نفر</th><th>نقش</th><th>مجموع ساعت</th><th>روز ثبت</th><th>ساعت در روز</th><th>سرعت (sub-task در روز)</th></tr></thead><tbody>${people}</tbody></table></div>` : ''}`;
}
