// "Front-end's turn", same shape as the status dashboard's front-end team card:
//   - ready now      back-end all Done, no front-end sub-task yet; ONE story per module, because stories of one
//                    module share integration files (route/tab registry, service file, locale file)
//   - after those    same-module stories that queue behind the one above
//   - held           ready, but the module already has front-end work in flight
//   - in progress    front-end sub-tasks exist and some are open
// plus a collapsed list of stories whose back-end is over half done (front-end could start from the API contract).
// Scope: the running sprint when there is one, otherwise every open story. Everything is read from Jira's sub-task
// counts, never from estimates or labels: a story whose front-end sub-tasks are not created yet is exactly the case
// that has to show up here. Pure: HTML string.
const MAX_ROWS = 60;

/** @returns {object} lists of { s, beTotal, beDone, feTotal, feOpen, mod, inSprint, waits } plus scope info */
export function feCandidates(R, P) {
  const by = Object.fromEntries(P.list.map((s) => [s.k, s]));
  const sprint = R.CURRENT_SPRINT || null;
  const sprintKeys = sprint ? new Set(sprint.epics.flatMap((g) => g.items.map((x) => x.k))) : null;
  const M = R.MODULES;
  const grouped = !!M && M.mode !== 'none'; // without modules there is nothing to collide on
  const info = (s, beTotal, beOpen, feTotal, feOpen) => ({
    s, beTotal, beDone: beTotal - beOpen, feTotal, feOpen, mod: grouped ? M.of?.[s.k] || { id: '?', label: 'بدون ماژول' } : null,
    inSprint: !sprintKeys || sprintKeys.has(s.k), waits: s.deps.filter((d) => by[d] && !by[d].done)
  });
  const order = (a, b) => (a.waits.length ? 1 : 0) - (b.waits.length ? 1 : 0) || (a.s.rank || 0) - (b.s.rank || 0) || a.s.k.localeCompare(b.s.k, 'en', { numeric: true });

  const ready = [];
  const contract = [];
  const active = [];
  for (const s of P.list) {
    if (s.done) continue;
    const beTotal = s.subs?.be?.total || 0;
    const feTotal = s.subs?.fe?.total || 0;
    const x = info(s, beTotal, s.subs?.be?.open || 0, feTotal, s.subs?.fe?.open || 0);
    if (feTotal > 0) {
      if (x.feOpen > 0) active.push(x); // all front-end sub-tasks Done but the story still open = stale status, not work
    } else if (beTotal > 0) {
      if (x.beDone === beTotal) ready.push(x);
      else if (x.beDone / beTotal > 0.5) contract.push(x);
    }
  }
  [ready, contract, active].forEach((l) => l.sort(order));

  const busy = new Map(active.filter((x) => x.mod).map((x) => [x.mod.id, x.mod.label])); // front-end in flight blocks the module, whatever the sprint
  const now = [];
  const queued = [];
  const held = [];
  const taken = new Set();
  for (const x of ready.filter((r) => r.inSprint)) {
    if (x.mod && busy.has(x.mod.id)) held.push(x);
    else if (x.mod && taken.has(x.mod.id)) queued.push(x);
    else {
      now.push(x);
      if (x.mod) taken.add(x.mod.id);
    }
  }
  return {
    sprint, now, queued, held,
    active: active.filter((x) => x.inSprint),
    outside: ready.filter((x) => !x.inSprint),
    contract: contract.filter((x) => x.inSprint),
    busyModules: [...busy.values()],
    ready // every story ready for the front-end, any sprint
  };
}

/** @returns {string} inner HTML of #fe-ready */
export function renderFeReady(R, P) {
  const { esc, fa, kb, JIRA, KEY_RE } = R;
  const c = feCandidates(R, P);
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + esc(k)}" target="_blank" rel="noopener">${kb(k)}</a>` : kb(k));

  const item = (x) => {
    const tags = [
      x.s.f.includes('d') ? '<span class="tg dec">تصمیم باز</span>' : '',
      x.s.f.includes('ext') ? '<span class="tg ext">وابستگی بیرونی</span>' : '',
      x.waits.length ? `<span class="tg ext">منتظر ${x.waits.map((k) => esc(k)).join('، ')}</span>` : ''
    ].join(' ');
    const prog = x.feTotal ? `فرانت: ${fa(x.feTotal - x.feOpen, 0)} از ${fa(x.feTotal, 0)} Done` : `بک‌اند: ${fa(x.beDone, 0)} از ${fa(x.beTotal, 0)} Done`;
    return `<li><div class="l1">${link(x.s.k)}<span>${esc(x.s.title)}</span></div><div class="m2">${x.mod ? `<span>${esc(x.mod.label)}</span>` : ''}<span>${prog}</span>${tags}</div></li>`;
  };
  const block = (title, list) => (list.length
    ? `<div class="fe-blk"><h3 class="fe-h">${title} <span class="num">(${fa(list.length, 0)})</span></h3><ul class="fe-list">${list.slice(0, MAX_ROWS).map(item).join('')}${list.length > MAX_ROWS ? `<li class="m2">و ${fa(list.length - MAX_ROWS, 0)} مورد دیگر</li>` : ''}</ul></div>`
    : '');
  const note = (t) => `<p class="fe-note">${t}</p>`;

  const scope = c.sprint ? `مبنا: اسپرینت فعال <b>${esc(c.sprint.name)}</b>` : 'اسپرینت فعالی پیدا نشد؛ همهٔ استوری‌های باز پروژه در نظر گرفته شده‌اند.';
  const parts = [
    `<p class="lead" style="font-size:13px">${scope}</p>`,
    c.now.length
      ? block('قابل شروع به‌صورت هم‌زمان: بک‌اند تکمیل شده و از هر ماژول یک مورد انتخاب شده تا در فایل‌های مشترک تداخل ایجاد نشود', c.now)
      : note('در حال حاضر استوری آماده‌ای برای شروع فرانت‌اند وجود ندارد.'),
    block('پس از ادغام موارد بالا قابل شروع است (هم‌ماژول با موارد بالا)', c.queued),
    block('بک‌اندشان تمام شده، ولی ماژولشان همین حالا کار فرانت در جریان دارد', c.held),
    block('در حال انجام', c.active),
    c.busyModules.length ? note(`تا پایان کار فرانت‌اند جاری، استوری جدیدی در این ماژول‌ها شروع نشود (فایل‌های مشترک): ${c.busyModules.map(esc).join('، ')}`) : '',
    c.outside.length ? note(`${fa(c.outside.length, 0)} استوری آمادهٔ فرانت‌اند نیز خارج از این اسپرینت وجود دارد: ${c.outside.map((x) => link(x.s.k)).join('، ')}`) : '',
    c.contract.length
      ? `<details class="own" style="margin-top:6px"><summary>قابل شروع با قرارداد API، بک‌اند هنوز تمام نشده <span class="own-sum">${fa(c.contract.length, 0)} استوری</span></summary><div class="own-body">${block('بیش از نصف بک‌اندشان Done شده ولی هنوز قطعی نیست', c.contract)}</div></details>`
      : ''
  ];
  return `<div class="fe-plan">${parts.join('')}</div>`;
}
