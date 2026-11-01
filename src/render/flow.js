// Flow board: epic rows x dependency-step columns, one chip per story, a column of
// recently finished stories and an svg layer that the browser UI (src/browser/flow-ui.js)
// fills with dependency wires. Pure string building, no DOM.

const KEY_PREFIX_RE = /^[A-Z][A-Z0-9_]+-/;

/** Normalise what the user typed in the filter box into an issue key ("12" -> "PROJ-12"). */
export function normKey(v, project) {
  let k = String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(k) && project) k = project + '-' + k;
  return k;
}

/**
 * Dependency chain of one story: everything it waits on (up) and everything that
 * waits on it (down), transitively. `by`: key -> story, `succ`: key -> keys that wait on it.
 */
export function chainOf(k, by, succ) {
  const up = new Set();
  const down = new Set();
  const walkUp = (x) => (by[x] ? by[x].deps : []).forEach((d) => { if (!up.has(d)) { up.add(d); walkUp(d); } });
  const walkDn = (x) => (succ[x] || []).forEach((d) => { if (!down.has(d)) { down.add(d); walkDn(d); } });
  walkUp(k);
  walkDn(k);
  return { up, down };
}

const STEP_NAMES = ['شروع فوری', 'بعد از گام ۱', 'بعد از گام ۲', 'بعد از گام ۳', 'بعد از گام ۴', 'بعد از گام ۵', 'بعد از گام ۶'];

/**
 * @param {object} R            render environment (env.js)
 * @param {object} P            engine.plan(state) result
 * @param {Set<string>} critStories  keys of stories on the critical chain
 * @param {string|null} flowQuery    story key whose dependency chain is the only thing shown, or null
 * @returns {{ html: string, ctx: { by: object, succ: object, query: string|null, status: string } }}
 *   html goes into #flow; ctx is kept by the caller and handed to bindFlow (getFlowCtx).
 *   ctx.query is the query actually applied (null when the key is not on this board any more);
 *   ctx.status is the text of #flow-q-status.
 */
export function renderFlow(R, P, critStories, flowQuery) {
  const { EP, EP_ORDER, esc, fa, col, kb, JIRA, fmtD, parseDay } = R;
  const crit = critStories || new Set();
  const by = Object.fromEntries(P.list.map((s) => [s.k, s]));
  const succ = {};
  P.list.forEach((s) => s.deps.forEach((d) => (succ[d] = succ[d] || []).push(s.k)));
  const query = flowQuery && by[flowQuery] ? flowQuery : null;
  const chain = query ? chainOf(query, by, succ) : null;
  const keep = chain ? new Set([query, ...chain.up, ...chain.down]) : null;

  const lvl = {};
  const busy = new Set(); // guards against dependency cycles
  const L = (k) => {
    if (lvl[k] != null) return lvl[k];
    if (busy.has(k)) return 0;
    busy.add(k);
    const ds = by[k].deps.filter((d) => by[d] && !by[d].done);
    lvl[k] = ds.length ? 1 + Math.max(...ds.map(L)) : 0;
    busy.delete(k);
    return lvl[k];
  };
  const work = P.list.filter((s) => !s.hist);
  work.forEach((s) => L(s.k));
  const maxL = work.length ? Math.max(...work.map((s) => lvl[s.k])) : 0;
  // with a filter, only the steps that still hold a card stay on the board
  const levels = keep
    ? [...new Set(work.filter((s) => keep.has(s.k)).map((s) => lvl[s.k]))].sort((a, b) => a - b)
    : Array.from({ length: maxL + 1 }, (_, i) => i);
  const showHist = (R.state.hist || !!keep) && P.list.some((s) => s.hist && (!keep || keep.has(s.k)));
  const grid = `grid-template-columns: 190px ${showHist ? 'minmax(220px, 1.4fr) ' : ''}repeat(${Math.max(1, levels.length)}, minmax(150px, 1fr));`;

  let h = `<svg class="wires" id="wires" aria-hidden="true"></svg>`;
  h += `<div class="f-row f-head" style="${grid}"><div>اپیک</div>`
    + (showHist ? `<div>انجام‌شده<small>${keep ? 'پیش‌نیازهای Done' : 'پیش از شروع برنامه'}</small></div>` : '')
    + levels.map((i) => `<div>گام ${fa(i + 1)}<small>${STEP_NAMES[i] || ''}</small></div>`).join('') + `</div>`;

  EP_ORDER.forEach((ep) => {
    const ss = P.list.filter((s) => s.ep === ep && (showHist || !s.hist) && (!keep || keep.has(s.k)));
    if (!ss.length) return;
    const e = EP[ep];
    const nDone = P.list.filter((s) => s.ep === ep && s.done).length;
    const nAll = P.list.filter((s) => s.ep === ep).length;
    h += `<div class="f-row" style="${grid}"><div class="f-lab"><span class="n"><i class="sw ${e.t ? '' : 'hatch'}" style="background:${e.t ? col(e.t) : ''}"></i>${esc(e.n)}</span><span class="m">${e.k ? kb(e.k) + ' · ' : 'پیشنهادی · '}${nDone ? `${fa(nDone)} از ${fa(nAll)} ✓` : `${fa(nAll)} کار`}</span></div>`;
    if (showHist) {
      h += `<div class="f-cell hist">` + ss.filter((s) => s.hist).map((s) =>
        `<a class="mini" data-k="${esc(s.k)}" href="${esc(JIRA + s.k)}" target="_blank" rel="noopener" title="${esc(s.k + ' · ' + s.title + (s.res ? ' · ' + fmtD.format(parseDay(s.res)) : ''))}" style="--c:${col(e.t)}">${esc(s.k.replace(KEY_PREFIX_RE, ''))}</a>`
      ).join('') + `</div>`;
    }
    for (const i of levels) {
      h += `<div class="f-cell">` + ss.filter((s) => !s.hist && lvl[s.k] === i).map((s) => {
        const badge = s.done ? 'done' : s.rc ? 'rc' : s.f.includes('ip') ? 'ip' : s.f.includes('ext') ? 'ext' : s.f.includes('new') ? 'new' : '';
        const cls = ['chip', s.f.includes('x') ? 'sugg' : '', s.f.includes('d') && !s.done ? 'gate' : '', badge, crit.has(s.k) ? 'crit' : ''].join(' ');
        const roles = s.done
          ? `<i>✓ ${s.res ? fmtD.format(parseDay(s.res)) : 'Done'}</i>`
          : s.rc
            ? '<i>✓ sub-taskها</i>'
            : `${s.sbe ? `<i title="sub-task بک‌اند"><span class="role-dot be"></span>${fa(s.sbe)}</i>` : ''}${s.sfe ? `<i title="sub-task فرانت"><span class="role-dot fe"></span>${fa(s.sfe)}</i>` : ''}`;
        return `<button type="button" class="${cls}" data-k="${esc(s.k)}" style="--c:${col((EP[s.ep] || e).t)}"><span class="meta">${kb(s.k)}<span class="roles">${roles}</span></span><span class="t">${esc(s.title)}</span></button>`;
      }).join('') + `</div>`;
    }
    h += `</div>`;
  });

  const status = chain ? `${query}: ${fa(chain.up.size)} پیش‌نیاز و ${fa(chain.down.size)} استوری وابسته` : '';
  return { html: h, ctx: { by, succ, query, status } };
}
