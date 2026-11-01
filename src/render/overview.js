// Project overview: every epic from its first completed story to its planned delivery.

/**
 * @returns {{ progress: string, map: string, legend: string }}
 *   progress -> #ov-progress, map -> #ov, legend -> #legend-ov
 */
export function renderOverview(R, P) {
  const { fa, esc, col, EP, EP_ORDER, JIRA, wdDate, dateAt, endDate, wdIndex, parseDay, fmtD, fmtDY, fmtMon, fmtYr } = R;
  const real = P.list.filter((s) => !s.f.includes('x'));
  const nDone = real.filter((s) => s.done).length;
  const nRc = real.filter((s) => s.rc).length;
  const nAll = real.length;
  const nOpen = nAll - nDone - nRc;
  const pct = (n) => (100 * n) / Math.max(1, nAll);
  const resIdx = (s) => Math.min(P.off, s.res ? wdIndex(parseDay(s.res)) : P.off);
  const storyEnd = {};
  P.sched.forEach((v) => {
    const k = v.t.s.k;
    storyEnd[k] = Math.max(storyEnd[k] == null ? -Infinity : storyEnd[k], v.e);
  });
  const doneIdx = real.filter((s) => s.done).map(resIdx);
  const first = Math.min(P.off, ...doneIdx);
  const S0 = first - 3;
  const S1 = Math.ceil(P.span) + 6;
  const N = S1 - S0;
  const PX = Math.max(4, Math.min(14, 1100 / N));
  const W = Math.ceil(N * PX);
  const X = (d) => (d - S0) * PX;

  const progress = `
      <div class="big"><b>${fa(nDone)}</b> از ${fa(nAll)} استوری Done، یعنی ${fa(Math.round(pct(nDone)), 0)}٪ پروژه</div>
      <div class="pbig" role="img" aria-label="${fa(nDone)} انجام‌شده، ${fa(nRc)} آماده بستن، ${fa(nOpen)} باز"><i class="d" style="width:${pct(nDone)}%"></i><i class="r" style="width:${pct(nRc)}%"></i><i class="p" style="width:${pct(nOpen)}%"></i></div>
      <div class="ov-stats"><span>آماده بستن: <b>${fa(nRc)}</b></span><span>باز در برنامه: <b>${fa(nOpen)}</b></span><span>اولین استوری بسته‌شده: <b>${fmtDY.format(dateAt(first))}</b></span><span>تحویل برنامه‌ریزی‌شده: <b>${fmtDY.format(endDate(P.span))}</b></span></div>`;
  const legend = '<span><i class="sw" style="border-radius:50%;background:var(--fg2)"></i>استوری Done</span><span><i class="sw" style="height:4px;background:var(--fg2);opacity:.5"></i>بازهٔ انجام‌شده</span><span><i class="sw" style="background:repeating-linear-gradient(45deg,var(--fg2) 0 2px,transparent 2px 5px);border:1px solid var(--fg2)"></i>باقی‌ماندهٔ برنامه</span><span><i class="sw" style="background:var(--accent);width:3px"></i>امروز</span>';

  // header: month boundaries
  let h = `<div class="ov-row ov-head"><div class="ov-lab">ماه</div><div class="ov-track" style="width:${W}px">`;
  let lastM = '';
  for (let d = S0; d <= S1; d++) {
    const dt = wdDate(d);
    const m = fmtMon.format(dt);
    if (m !== lastM) {
      h += `<div class="tick" style="inset-inline-start:${X(d)}px"><b>${m}</b>${lastM ? '' : fmtYr.format(dt)}</div>`;
      lastM = m;
    }
  }
  h += '</div></div>';

  // weekly throughput: real completions vs planned completions
  const buckets = {};
  const add = (d, k) => {
    const b = Math.floor((d - S0) / 5);
    (buckets[b] = buckets[b] || { d: 0, p: 0 })[k]++;
  };
  doneIdx.forEach((d) => add(d, 'd'));
  Object.values(storyEnd).forEach((e) => add(Math.max(P.off, Math.ceil(e - 1e-6) - 1), 'p'));
  const maxC = Math.max(1, ...Object.values(buckets).map((b) => b.d + b.p));
  h += `<div class="ov-row ov-hist"><div class="ov-lab"><span class="n">استوری در هفته</span><span class="m">واقعی · برنامه</span></div><div class="ov-track" style="width:${W}px"><span class="hb-max">بیشینه ${fa(maxC)}</span>`;
  Object.entries(buckets).forEach(([b, c]) => {
    const x = X(S0 + b * 5) + 1;
    const w = Math.max(2, 5 * PX - 2);
    const hd = (66 * c.d) / maxC;
    const hp = (66 * c.p) / maxC;
    const tip = `هفتهٔ ${fmtD.format(wdDate(S0 + b * 5))}: ${fa(c.d)} Done${c.p ? '، ' + fa(c.p) + ' برنامه‌ریزی‌شده' : ''}`;
    if (c.d) h += `<div class="hb" title="${tip}" style="inset-inline-start:${x}px;width:${w}px;height:${hd}px"></div>`;
    if (c.p) h += `<div class="hb plan" title="${tip}" style="inset-inline-start:${x}px;width:${w}px;height:${hp}px;bottom:${6 + hd}px"></div>`;
  });
  h += '</div></div>';

  // epic rows: finished epics first, then the ones in flight
  const fin = R.eng.epicFinish(P);
  const epDone = (ep) => {
    const ss = real.filter((s) => s.ep === ep);
    return ss.length > 0 && ss.every((s) => s.done);
  };
  const groups = [['اپیک‌های تکمیل‌شده', EP_ORDER.filter((ep) => epDone(ep))], ['اپیک‌های در جریان', EP_ORDER.filter((ep) => !epDone(ep))]];
  groups.forEach(([gname, eps]) => {
    const rowsHtml = eps.map((ep) => {
      const ss = real.filter((s) => s.ep === ep);
      if (!ss.length) return '';
      const e = EP[ep];
      const c = col(e.t);
      const done = ss.filter((s) => s.done);
      const di = done.map(resIdx).sort((a, b) => a - b);
      const f = fin[ep];
      let t = '';
      if (di.length > 1) t += `<div class="ov-done" style="--c:${c};inset-inline-start:${X(di[0])}px;width:${X(di[di.length - 1]) - X(di[0])}px"></div>`;
      if (f) t += `<div class="ov-plan" style="--c:${c};inset-inline-start:${X(f.s)}px;width:${Math.max(3, (f.e - f.s) * PX)}px" title="${esc(e.n)}: ${fmtD.format(dateAt(f.s))} تا ${fmtD.format(endDate(f.e))}"></div>`;
      const stack = {};
      done.forEach((s) => {
        const d = resIdx(s);
        const n = (stack[d] = (stack[d] || 0) + 1);
        t += `<a class="ov-dot" href="${esc(JIRA + s.k)}" target="_blank" rel="noopener" title="${esc(s.k + ' · ' + s.title + (s.res ? ' · ' + fmtD.format(parseDay(s.res)) : ''))}" style="--c:${c};inset-inline-start:${X(d) + PX / 2}px;top:${17 - ((n - 1) % 4) * 6 + (n > 4 ? 12 : 0)}px"></a>`;
      });
      const endX = Math.max(f ? X(f.e) : 0, di.length ? X(di[di.length - 1]) + PX : 0);
      const allDone = done.length === ss.length;
      t += `<span class="ov-end ${allDone ? 'ok' : ''}" style="inset-inline-start:${endX + 4}px">${allDone ? '✓ ' + (di.length ? fmtD.format(dateAt(di[di.length - 1])) : 'تمام') : f ? 'تحویل ' + fmtD.format(endDate(f.e)) : 'آماده بستن'}</span>`;
      const p = (100 * done.length) / ss.length;
      return `<div class="ov-row"><div class="ov-lab" style="--c:${c}"><span class="n"><i class="sw ${e.t ? '' : 'hatch'}" style="background:${e.t ? c : ''}"></i>${esc(e.n)}</span><span class="m">${fa(done.length)} از ${fa(ss.length)}<span class="pb"><i style="width:${p}%"></i></span></span></div><div class="ov-track" style="width:${W}px">${t}</div></div>`;
    }).join('');
    if (rowsHtml) h += `<div class="ov-row ov-group"><div class="ov-lab">${gname}</div><div class="ov-track" style="width:${W}px"></div></div>` + rowsHtml;
  });

  // vertical guides: sprint starts and today
  h += `<div style="position:absolute;inset-block:0;inset-inline-start:210px;width:${W}px;pointer-events:none">`;
  (R.SPRINT_MARKS || []).forEach(([n, d]) => {
    const dd = parseDay(d);
    if (!dd) return;
    const i = wdIndex(dd);
    if (i > S0 && i < S1) h += `<div class="ov-vl" style="inset-inline-start:${X(i)}px;top:40px"><span>${esc(n)}</span></div>`;
  });
  h += `<div class="ov-vl today" style="inset-inline-start:${X(P.off)}px"><span>امروز</span></div></div>`;
  return { progress, map: h, legend };
}
