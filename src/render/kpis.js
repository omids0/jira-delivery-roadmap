// Top of the page: legends, KPI strip and the "what-if" line. Pure string builders
// over the shared render environment R and a plan result P (engine.plan(state)).

/**
 * Numbers shared by the KPI strip, the what-if line and other renderers.
 * @param {object} R    render environment (createEnv)
 * @param {object} P    plan result
 * @param {Set<string>} [crit]  critical chain ids (computed when omitted)
 */
export function computeSummary(R, P, crit) {
  crit = crit || R.eng.criticalChain(P.sched);
  const critStories = new Set([...crit].map((id) => id.split(':')[0]));
  const minSpan = P.tasks.length ? R.eng.unlimited(P.tasks) - P.off : 0;
  const sum = (r, f) => P.tasks.filter((t) => t.role === r).reduce((a, t) => a + t[f], 0);
  const beDays = sum('BE', 'dur');
  const feDays = sum('FE', 'dur');
  const jiraStories = P.list.filter((s) => !s.f.includes('x') && !s.done && !s.rc).length;
  const totalReal = P.list.filter((s) => !s.f.includes('x')).length;
  const doneNow = P.list.filter((s) => s.done).length;
  const rcNow = P.list.filter((s) => s.rc).length;
  const spanW = Math.ceil(P.span - P.off);
  const byStory = R.STORY_PACE > 0 ? Math.ceil(jiraStories / R.STORY_PACE) : null; // null: no measured story pace yet
  const SPRINT_LEN = (R.NEXT_SPRINT && R.NEXT_SPRINT.len) || 10;
  return {
    crit, critStories, minSpan, sum, beDays, feDays, jiraStories, totalReal, doneNow, rcNow, spanW, byStory, SPRINT_LEN,
    beSubs: sum('BE', 'subs'), feSubs: sum('FE', 'subs')
  };
}

/** Legend under the flow chart (withMarks = false) and under the gantt (withMarks = true). */
export function legendHTML(R, withMarks) {
  let h = '<span><i class="sw" style="background:var(--s8)"></i>اپیک تکمیل‌شده</span><span>رنگ هر اپیک کنار نام آن در ردیفش آمده است</span>';
  if (withMarks) h += '<span><i class="sw crit"></i>مسیر بحرانی</span><span><i class="sw gate"></i>منتظر تصمیم PO</span>';
  h += '<span><span class="done-ico" style="width:14px;height:14px;font-size:9px">✓</span>انجام‌شده / آماده بستن</span>';
  if (!withMarks) h += '<span><i class="sw gate"></i>تصمیم باز</span><span><i class="sw" style="border:1.5px solid var(--crit)"></i>منتظر سرویس بیرونی</span>';
  return h;
}

/** KPI strip -> #kpis */
export function renderKpis(R, P, crit) {
  const { fa, fmtDY, endDate } = R;
  const m = computeSummary(R, P, crit);
  return [
    ['hero', `${fa(m.spanW)} <small>روز کاری</small>`, `حدود ${fa(m.spanW / 5)} هفته، معادل ${fa(m.spanW / m.SPRINT_LEN)} اسپرینت ${fa(m.SPRINT_LEN, 0)}‌روزه`],
    ['hero', fmtDY.format(endDate(P.span)), 'تاریخ تحویل آخرین استوری'],
    ['', `${fa(m.jiraStories)} <small>از ${fa(m.totalReal)}</small>`, 'استوری باز، از کل استوری‌های پروژه'],
    ['', `${fa(m.beSubs)} <small>/ ${fa(m.feSubs)}</small>`, 'sub-task تخمینی بک‌اند / فرانت'],
    m.byStory == null
      ? ['', '—', 'کنترل متقابل: سرعت استوری در روز هنوز قابل محاسبه نیست']
      : ['', `${fa(m.byStory)} <small>روز</small>`, `کنترل متقابل: با سرعت ${fa(R.STORY_PACE)} استوری در روز`],
    ['', `${fa(Math.ceil(m.minSpan * 10) / 10)} <small>روز</small>`, 'کف زمانی با نیروی نامحدود (فقط وابستگی‌ها)']
  ].map(([c, v, l]) => `<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
}

/** What-if line (one more person; epics are re-split automatically) -> #whatif */
export function renderWhatIf(R, P, crit) {
  const { fa, state } = R;
  const m = computeSummary(R, P, crit);
  const noOwn = Object.assign({}, state, { own: null });
  const pBE = R.eng.plan({ ...noOwn, be: state.be + 1 }).span;
  const pFE = R.eng.plan({ ...noOwn, fe: state.fe + 1 }).span;
  const gain = (x) => Math.round((P.span - x) * 10) / 10;
  const util = (r) => {
    const n = r === 'BE' ? state.be : state.fe;
    const d = r === 'BE' ? m.beDays : m.feDays;
    const slots = (P.pars?.[r] || Array(Math.max(1, n)).fill(state.par)).reduce((a, b) => a + b, 0); // stories the people can run at once
    return Math.round((100 * d) / (Math.max(1, slots) * Math.max(0.1, P.span - P.off)));
  };
  return `
      <span>اگر یک نفر بک‌اند اضافه شود: <b>${gain(pBE) > 0.2 ? fa(gain(pBE)) + ' روز زودتر' : 'بدون تغییر'}</b></span>
      <span>اگر یک نفر فرانت اضافه شود: <b>${gain(pFE) > 0.2 ? fa(gain(pFE)) + ' روز زودتر' : 'بدون تغییر'}</b></span>
      <span>درصد اشغال: بک‌اند <b>${fa(util('BE'), 0)}٪</b> · فرانت <b>${fa(util('FE'), 0)}٪</b></span>
      <span>مسیر بحرانی: <b>${fa(m.crit.size)}</b> کار</span>`;
}
