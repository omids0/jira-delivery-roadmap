// Sprint proposal: next-sprint card (sp-next), epic x sprint matrix (sp-matrix, a <table>)
// and the legend line (legend-sp). Pure: (R, P, crit) => { next, matrix, legend }.
export function renderSprints(R, P, crit) {
  const { fa, esc, kb, col, JIRA, KEY_RE, EP, EP_ORDER, EP_BY_KEY, DEP_INFO, NEXT_SPRINT, META, fmtD, dateAt, endDate } = R;
  const { sprints } = R.eng.sprintPlan(P, R.state);
  const critK = new Set([...crit].map((id) => id.split(':')[0]));
  const link = (k) => (KEY_RE.test(k) ? `<a href="${JIRA + k}" target="_blank" rel="noopener">${kb(k)}</a>` : `<span class="mono">${esc(k)}</span>`);
  const spName = (n) => `${META.sprintWord} ${fa(n)}`;
  const range = (sp) => `${fmtD.format(dateAt(sp.w0))} تا ${fmtD.format(endDate(sp.w1))}`;
  const legend = `<span><span class="tg crit">بحرانی</span>روی مسیر بحرانی</span><span><span class="tg dec">تصمیم</span>تصمیم باز</span><span><span class="tg ext">⛔</span>وابستگی بیرونی</span><span><span class="tg carry">ادامه</span>از اسپرینت قبل</span><span><span class="tg crit">اولویت بالا</span>اپیک اولویت‌دار</span>`;

  const sp = sprints.find((s) => s.n === NEXT_SPRINT.n) || sprints[0];
  if (!sp) return { next: '<p class="lead">کاری برای برنامه‌ریزی باقی نمانده است.</p>', matrix: '', legend };
  const realDone = sp.done.filter((o) => !o.story.f.includes('x'));
  const byEp = {};
  sp.done.forEach((o) => (byEp[o.story.ep] = byEp[o.story.ep] || []).push(o));
  const epOrder = EP_ORDER.filter((ep) => byEp[ep]);
  const committed = { BE: sp.done.reduce((a, o) => a + o.be, 0), FE: sp.done.reduce((a, o) => a + o.fe, 0) };
  const loadRow = (r, lbl) => {
    const val = NEXT_SPRINT.target ? committed[r] : sp.load[r];
    const pct = sp.cap[r] ? Math.round((100 * val) / sp.cap[r]) : 0;
    return `<div class="load"><span>${lbl}: <b>${fa(Math.round(val))}</b> از ظرفیت ${fa(Math.round(sp.cap[r]))} sub-task (${fa(pct, 0)}٪)</span><span class="b2"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(100, pct)}%"></i></span></div>`;
  };
  const tags = (o) => {
    const s = o.story;
    const t = [];
    if (critK.has(s.k)) t.push('<span class="tg crit">بحرانی</span>');
    if (s.f.includes('d')) t.push('<span class="tg dec">تصمیم</span>');
    if (s.f.includes('ext')) t.push('<span class="tg ext">⛔ بیرونی</span>');
    if (o.stretch) t.push('<span class="tg ext">کششی — فراتر از ظرفیت</span>');
    if (s.lowCrit) t.push('<span class="tg dec">کم‌اولویت، پیش‌نیاز</span>');
    if (s.f.includes('cv')) t.push('<span class="tg ip">از اسپرینت قبل — فقط فرانت</span>');
    else if (s.f.includes('ip')) t.push('<span class="tg ip">در جریان</span>');
    else if (o.s < sp.w0 - 1e-6) t.push('<span class="tg carry">ادامه</span>');
    return t.join('');
  };
  const PRI = META.priority || {};
  const prBadge = (k) => ((PRI.high || []).includes(k) ? '<span class="tg crit">اولویت بالا</span>' : (PRI.low || []).includes(k) ? '<span class="tg carry">کم‌اولویت</span>' : '');
  const epName = (k) => { const c = EP_BY_KEY[k]; return esc(c ? EP[c].n : k); };
  const roleTxt = (o) => [o.be ? `بک‌اند ${fa(o.be)}` : '', o.fe ? `فرانت ${fa(o.fe)}` : ''].filter(Boolean).join(' · ') + ' sub-task';
  const epCards = epOrder.map((ep) => {
    const e = EP[ep];
    const items = byEp[ep];
    const goal = sp.goals.includes(ep);
    return `<div class="sp-ep" style="--c:${col(e.t)}"><div class="sp-ep-h"><i class="sw ${e.t ? '' : 'hatch'}" style="background:${e.t ? col(e.t) : ''}"></i>${esc(e.n)}<small>${fa(items.length)} استوری</small>${goal ? '<span class="tg goal">✓ اپیک تحویل می‌شود</span>' : ''}${prBadge(e.k)}</div>
        <ul>${items.map((o) => `<li><div class="l1">${link(o.story.k)}<span>${esc(o.story.title)}</span></div><div class="m2">${tags(o)}<span>${roleTxt(o)} · تا ${fmtD.format(endDate(o.e))}</span></div></li>`).join('')}</ul></div>`;
  }).join('');
  const activeN = sp.active.filter((ep) => ep !== 'en').length;
  const goalNames = sp.goals.map((ep) => `<b>${esc(EP[ep].n)}</b>`);
  const goalTxt = goalNames.length ? `تحویل کامل ${goalNames.join('، ')}، و پیشرفت هم‌زمان در ${fa(activeN)} اپیک.` : `پیشرفت هم‌زمان در ${fa(activeN)} اپیک؛ هیچ اپیکی در این اسپرینت کامل نمی‌شود.`;
  const decisions = realDone.filter((o) => o.story.f.includes('d'));
  const exts = realDone.filter((o) => o.story.f.includes('ext'));
  const carry = sp.started.filter((o) => !o.story.f.includes('x'));
  const list = (arr, fmt) => (arr.length ? `<ul>${arr.map(fmt).join('')}</ul>` : '<p>هیچ</p>');
  const next = `<article class="sp-next">
      <header class="sp-head">
        <div class="t"><span class="eyebrow">پیشنهاد برای اسپرینت بعدی</span><h3>${spName(sp.n)} · ${range(sp)}</h3><p class="sp-goal">هدف: ${goalTxt}</p>${NEXT_SPRINT.target && sp.done.some((o) => o.stretch) ? `<p class="sp-goal">هدف اسپرینت ${fa(NEXT_SPRINT.target)} استوری است. با ${esc(P.paceLabel || 'سرعت اسپرینت‌های قبل')}، ${fa(sp.done.filter((o) => !o.stretch).length)} استوری در این بازه تمام می‌شود و ${fa(sp.done.filter((o) => o.stretch).length)} استوری دیگر کششی‌اند: اگر تیم جلوتر از سرعت قبلی برود، این‌ها هم تحویل می‌شوند و گرنه به اسپرینت بعد می‌روند.</p>` : ''}</div>
        <div class="sp-stats">
          <div><div class="v">${fa(realDone.length)}</div>استوری برای تحویل</div>
          <div><div class="v">${fa(activeN)}</div>اپیک در جریان</div>
          ${loadRow('BE', 'بک‌اند')}${loadRow('FE', 'فرانت')}
        </div>
      </header>
      <div class="sp-epics">${epCards}</div>
      <div class="sp-foot">
        <div><h4>پیش از شروع اسپرینت تصمیم بگیرید (${fa(decisions.length)})</h4>${list(decisions, (o) => `<li>${link(o.story.k)} ${esc(o.story.title)}${(DEP_INFO[o.story.k] || {}).d && DEP_INFO[o.story.k].d.length ? ` — ${esc(DEP_INFO[o.story.k].d[0])}` : ''}</li>`)}</div>
        <div><h4>منتظر سرویس بیرونی (${fa(exts.length)})</h4>${list(exts, (o) => `<li>${link(o.story.k)} ${esc(((DEP_INFO[o.story.k] || {}).x || [])[0] || o.story.title)}</li>`)}<p style="margin-top:6px">اگر این سرویس‌ها تا شروع اسپرینت آماده نشوند، این استوری‌ها را با کار بعدی همان اپیک جابه‌جا کنید.</p></div>
        ${PRI.high || PRI.low ? `<div><h4>اولویت اپیک‌ها</h4><p>اولویت بالا: ${(PRI.high || []).map(epName).join('، ') || '—'}</p><p style="margin-top:4px">کم‌اولویت: ${(PRI.low || []).map(epName).join('، ') || '—'}. از این اپیک‌ها فقط استوری‌هایی در اسپرینت آمده‌اند که کار اولویت‌دار به آن‌ها وابسته است (${fa(realDone.filter((o) => o.story.lowCrit).length)} استوری).</p></div>` : ''}
        <div><h4>شروع در این اسپرینت، تحویل در بعدی (${fa(carry.length)})</h4>${list(carry, (o) => `<li>${link(o.story.k)} ${esc(o.story.title)} — تا ${fmtD.format(endDate(o.e))}</li>`)}</div>
      </div>
    </article>`;

  // epic x sprint matrix
  const eps = EP_ORDER.filter((ep) => sprints.some((s) => s.active.includes(ep) || s.done.some((o) => o.story.ep === ep)));
  const head = `<thead><tr><th>اپیک</th>${sprints.map((s) => `<th class="${s.n === sp.n ? 'next' : ''}">${s.n === sp.n ? '★ ' : ''}${spName(s.n)}<small>${s.n < NEXT_SPRINT.n ? 'باقی‌ماندهٔ جاری' : fmtD.format(dateAt(s.w0))}</small></th>`).join('')}<th>تحویل اپیک</th></tr></thead>`;
  const fin = R.eng.epicFinish(P);
  const body = eps.map((ep) => {
    const e = EP[ep];
    const c = col(e.t);
    return `<tr><td><span class="ep-name"><i class="sw ${e.t ? '' : 'hatch'}" style="background:${e.t ? c : ''}"></i>${esc(e.n)}</span></td>${sprints.map((s) => {
      const n = s.done.filter((o) => o.story.ep === ep).length;
      const isGoal = s.goals.includes(ep);
      const cell = n ? `<span class="cell ${isGoal ? 'fin' : ''}" style="--c:${c};--p:${Math.min(70, 16 + n * 12)}%" title="${esc(e.n)}: ${fa(n)} استوری${isGoal ? ' — اپیک کامل می‌شود' : ''}">${fa(n)}</span>` : s.active.includes(ep) ? `<span class="cell act" style="--c:${c}" title="در جریان">·</span>` : '';
      return `<td class="${s.n === sp.n ? 'next' : ''}">${cell}</td>`;
    }).join('')}<td class="n">${fin[ep] ? fmtD.format(endDate(fin[ep].e)) : '—'}</td></tr>`;
  }).join('');
  const foot = `<tfoot><tr><td>اپیک در جریان</td>${sprints.map((s) => `<td class="${s.n === sp.n ? 'next' : ''}">${fa(s.active.filter((ep) => ep !== 'en').length)}</td>`).join('')}<td></td></tr>
      <tr><td>استوری تحویلی</td>${sprints.map((s) => `<td class="${s.n === sp.n ? 'next' : ''}">${fa(s.done.filter((o) => !o.story.f.includes('x')).length)}</td>`).join('')}<td></td></tr>
      <tr><td>اپیک تحویلی</td>${sprints.map((s) => `<td class="${s.n === sp.n ? 'next' : ''}">${fa(s.goals.length)}</td>`).join('')}<td></td></tr></tfoot>`;
  return { next, matrix: head + `<tbody>${body}</tbody>` + foot, legend };
}
