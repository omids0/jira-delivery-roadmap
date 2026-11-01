// Measured team velocity of the closed sprints and the pace the plan is based on.

const perHead = (r, sp) => sp[r] / (sp.wd * sp[r + 'Heads']);

/** @returns {{ table: string, note: string }}  table -> #vel-tbl (inner HTML), note -> #vel-note */
export function renderVelocity(R) {
  const { fa, esc, SPRINTS } = R;
  const MAX = 20;
  const rate = (v, fe) => `<div class="rate"><span class="num" style="min-width:2.6em">${fa(v)}</span><span class="track"><i class="${fe ? 'fe' : ''}" style="width:${Math.min(100, (100 * v) / MAX)}%"></i></span></div>`;
  const p = R.PACE[R.state.pace] || R.PACE.avg;
  const table = '<thead><tr><th>اسپرینت</th><th>بازه</th><th>روز کاری (برنامه / واقعی)</th><th>استوری Done</th><th>sub-task بک‌اند</th><th>sub-task فرانت</th><th>نفرات بک‌اند / فرانت</th><th>بک‌اند: sub-task در روز هر نفر</th><th>فرانت: sub-task در روز هر نفر</th></tr></thead><tbody>' +
    SPRINTS.map((sp) => `<tr><td><b>${esc(sp.n)}</b></td><td>${esc(sp.from)} تا ${esc(sp.to)}</td><td class="n">${fa(sp.planned)} / <b>${fa(sp.wd)}</b></td><td class="n">${fa(sp.stories)}</td><td class="n">${fa(sp.be)}</td><td class="n">${fa(sp.fe)}</td><td class="n">${fa(sp.beHeads)} / ${fa(sp.feHeads)}</td><td>${rate(perHead('be', sp))}</td><td>${rate(perHead('fe', sp), true)}</td></tr>`).join('') +
    `<tr class="sum"><td colspan="7">مبنای این برنامه: ${esc(p.n)}</td><td>${rate(p.BE)}</td><td>${rate(p.FE, true)}</td></tr></tbody>`;

  const DEF = R.ctx.defaults;
  const totSt = SPRINTS.reduce((x, sp) => x + sp.stories, 0) || 1;
  const avgBE = SPRINTS.reduce((x, sp) => x + sp.be, 0) / totSt;
  const avgFE = SPRINTS.reduce((x, sp) => x + sp.fe, 0) / totSt;
  const late = SPRINTS.filter((sp) => sp.wd > sp.planned);
  const note = SPRINTS.length
    ? `هر استوری Done به طور میانگین ${fa(avgBE)} sub-task بک‌اند و ${fa(avgFE)} sub-task فرانت داشته است. استوری باز بدون sub-task بر همین مقیاس برآورد می‌شود (${fa(DEF.be, 0)} بک‌اند و ${fa(DEF.fe, 0)} فرانت)؛ برای استوری‌هایی که sub-task دارند، تعداد sub-taskهای باز واقعی در نظر گرفته می‌شود.${late.length ? ` ${late.map((sp) => esc(sp.n)).join(' و ')} بیشتر از زمان برنامه‌ریزی‌شده طول کشید و این کندی در سناریوی محتاطانه لحاظ شده است.` : ''}`
    : 'هنوز اسپرینت بسته‌شده‌ای برای کالیبراسیون وجود ندارد. سرعت از مقدار فرضی تنظیمات ساخت (defaultPace) آمده و باید پس از بسته شدن اولین اسپرینت دوباره ساخته شود.';
  return { table, note };
}
