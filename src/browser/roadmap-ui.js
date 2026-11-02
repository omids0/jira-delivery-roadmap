// Fills the sections of the roadmap page and wires its controls. The page frame
// (src/render/page.js) is painted once; every control change re-renders the
// sections in place by id, so the scroll position and open panels survive.
import { createEnv } from '../render/env.js';
import { renderEpics } from '../render/epics.js';
import { renderFeReady } from '../render/feReady.js';
import { renderFlow } from '../render/flow.js';
import { renderGantt } from '../render/gantt.js';
import { computeSummary, legendHTML, renderKpis, renderWhatIf } from '../render/kpis.js';
import { renderModules } from '../render/modules.js';
import { renderNotes } from '../render/notes.js';
import { renderOverview } from '../render/overview.js';
import { renderOwners } from '../render/owners.js';
import { renderPeople } from '../render/people.js';
import { renderRaw } from '../render/raw.js';
import { renderCurrentSprint } from '../render/sprintNow.js';
import { renderSprintOrder } from '../render/sprintOrder.js';
import { renderSprints } from '../render/sprints.js';
import { renderSprintSettings } from '../render/sprintSettings.js';
import { renderTeam } from '../render/team.js';
import { renderVelocity } from '../render/velocity.js';
import { renderWorklogPanel } from '../render/worklogPanel.js';
import { normDevs, normOwn, normSprint } from '../roadmapState.js';
import { bindFlow } from './flow-ui.js';
import { bindOwners } from './owners-ui.js';
import { bindTooltips } from './tooltip.js';

const clamp = (n) => Math.max(1, Math.min(6, n));

/**
 * @param {object} o
 * @param {Document} o.doc       the painted roadmap page
 * @param {object} o.ctx         planning context
 * @param {object} o.eng         engine
 * @param {object} o.state       UI state (mutated by the controls)
 * @param {() => void} o.persist saves `state`
 * @param {() => void} o.onRefresh  user pressed "refresh from Jira"
 * @returns {{ refresh: () => void, setStatus: (text: string, kind?: string) => void }}
 */
export function mountRoadmap({ doc, ctx, eng, state, persist, onRefresh }) {
  const R = createEnv(ctx, eng, state);
  const ui = { openPeople: new Set(), P: null, crit: null, flowCtx: null, flowQuery: null, ganttIndex: {} };
  const $ = (id) => doc.getElementById(id);
  const html = (id, v) => {
    const el = $(id);
    if (el) el.innerHTML = v ?? '';
  };
  const text = (id, v) => {
    const el = $(id);
    if (el) el.textContent = v ?? '';
  };

  function render() {
    const P = (ui.P = eng.plan(state));
    const crit = (ui.crit = eng.criticalChain(P.sched));
    const sum = computeSummary(R, P, crit);

    html('kpis', renderKpis(R, P, crit));
    html('whatif', renderWhatIf(R, P, crit));
    html('fe-ready', renderFeReady(R, P));
    const mod = renderModules(R);
    text('mod-note', mod.note);
    html('mod-bars', mod.bars);
    html('mod-tbl', mod.table);
    const ov = renderOverview(R, P);
    html('ov-progress', ov.progress);
    html('ov', ov.map);
    html('legend-ov', ov.legend);
    const vel = renderVelocity(R);
    html('vel-tbl', vel.table);
    html('vel-note', vel.note);
    html('legend-flow', legendHTML(R, false));
    html('legend-gantt', legendHTML(R, true));

    const flow = renderFlow(R, P, sum.critStories, ui.flowQuery);
    html('flow', flow.html);
    ui.flowCtx = flow.ctx;
    ui.flowQuery = flow.ctx.query ?? null; // the filter actually applied (null when the story is not on the board)
    const gantt = renderGantt(R, P, crit);
    html('gantt', gantt.html);
    ui.ganttIndex = gantt.index;
    const own = renderOwners(R, P);
    html('own-tbl', own.table);
    text('own-sum', own.summary);
    html('people', renderPeople(R, ui.openPeople));
    html('epic-tbl', renderEpics(R, P));
    html('notes', renderNotes(R, P));
    // the sprint proposal has its own plan when the sprint overrides the team (same plan otherwise)
    const PS = eng.planForSprint(state);
    const sp = renderSprints(R, PS, PS === P ? crit : eng.criticalChain(PS.sched));
    html('sp-now', renderCurrentSprint(R));
    const cur = ctx.CURRENT_SPRINT;
    if ($('now-sec')) $('now-sec').hidden = !cur; // no running sprint: the whole section stays hidden
    const nowLink = doc.querySelector('[data-jr-go="now-sec"]');
    if (nowLink) nowLink.hidden = !cur;
    html('sp-order', cur ? renderSprintOrder(R, eng.planSprintNow(state, P, cur.epics.flatMap((g) => g.items.filter((x) => x.cat !== 'done').map((x) => x.k)), cur.days.left)) : '');
    html('sp-wl', renderWorklogPanel(R));
    html('sp-next', sp.next);
    html('sp-matrix', sp.matrix);
    html('legend-sp', sp.legend);
    html('raw-tbl', renderRaw(R, P, crit));
    syncControls();
    bindSections();
  }

  // section behaviour: each bind* keeps one listener set per document, so calling it after every render is safe
  function bindSections() {
    bindFlow(R, doc, {
      getP: () => ui.P,
      getFlowCtx: () => ui.flowCtx,
      getFlowQuery: () => ui.flowQuery,
      setFlowQuery: (q) => {
        ui.flowQuery = q;
      },
      rerender: render
    });
    bindTooltips(R, doc, { getGanttIndex: () => ui.ganttIndex });
    bindOwners(R, doc, {
      getP: () => ui.P,
      setOwn: (own) => {
        state.own = normOwn(own);
        persist();
      },
      rerender: render
    });
  }

  function syncControls() {
    text('be-n', R.fa(state.be, 0));
    text('fe-n', R.fa(state.fe, 0));
  }

  // the team panel is rebuilt only when its row count or placeholder pace changes, never while someone types in it
  const change = (rebuildTeam = true) => {
    persist();
    if (rebuildTeam) {
      html('team', renderTeam(R));
      html('sp-cfg', renderSprintSettings(R));
    }
    render();
  };

  // which person cards are open (toggle does not bubble, so listen in the capture phase)
  doc.addEventListener('toggle', (e) => {
    const pk = e.target?.dataset?.pk;
    if (e.target?.matches?.('#people details.person') && pk) {
      if (e.target.open) ui.openPeople.add(pk);
      else ui.openPeople.delete(pk);
    }
  }, true);

  // sticky section menu: smooth-scroll below the sticky bar and mark the section in view
  const barHeight = () => doc.querySelector('.jr-bar')?.offsetHeight || 0;
  const markNav = (cur) => {
    for (const a of doc.querySelectorAll('.jr-nav a.on')) if (a !== cur) a.classList.remove('on');
    if (cur && !cur.classList.contains('on')) {
      cur.classList.add('on');
      cur.scrollIntoView?.({ inline: 'center', block: 'nearest' }); // keep the active link visible in a narrow menu (RTL-safe)
    }
  };
  // while a click-initiated smooth scroll runs, the menu must not follow the sections flying past
  let navLock = null;
  const lockNav = (ms) => {
    clearTimeout(navLock);
    navLock = setTimeout(() => {
      navLock = null;
    }, ms);
  };
  doc.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[data-jr-go]');
    const target = a && $(a.dataset.jrGo);
    if (!target) return;
    e.preventDefault();
    markNav(a);
    lockNav(400);
    if (target.tagName === 'DETAILS') target.open = true;
    const top = target.getBoundingClientRect().top + (doc.defaultView?.scrollY || 0) - barHeight() - 8;
    doc.defaultView?.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
  let spyQueued = false;
  doc.addEventListener('scroll', () => {
    if (navLock) {
      lockNav(150); // still scrolling: release 150 ms after the last scroll event
      return;
    }
    if (spyQueued) return;
    spyQueued = true;
    (doc.defaultView?.requestAnimationFrame || ((f) => f()))(() => {
      spyQueued = false;
      const line = barHeight() + 24;
      let cur = null;
      for (const a of doc.querySelectorAll('.jr-nav a[data-jr-go]')) {
        const el = $(a.dataset.jrGo);
        if (el && !el.hidden && el.getBoundingClientRect().top <= line) cur = a;
      }
      markNav(cur);
    });
  }, { passive: true });

  // controls: delegated on the document itself (the page is rewritten by document.write on a repaint)
  doc.addEventListener('click', (e) => {
    const t = e.target?.closest?.('button');
    if (!t) return;
    const m = /^(be|fe)-(inc|dec)$/.exec(t.id || '');
    if (m) {
      state[m[1]] = clamp(state[m[1]] + (m[2] === 'inc' ? 1 : -1));
      change();
    } else if (t.id === 'refresh-btn') onRefresh();
    else if (t.id === 'sp-reset') {
      state.sprint = normSprint({});
      html('sp-cfg', renderSprintSettings(R));
      change(false);
    }
  });
  doc.addEventListener('change', (e) => {
    const el = e.target;
    if (el?.name === 'pace') {
      state.pace = el.value;
      change();
    } else if (/^opt-(p2|p3|def|hist)$/.test(el?.id || '')) {
      state[el.id.slice(4)] = !!el.checked;
      change(false);
    } else if (el?.classList?.contains('sp-in')) {
      state.sprint = normSprint({ ...state.sprint, [el.dataset.k]: el.value === '' ? null : el.value });
      change(false);
    } else if (el?.classList?.contains('dev-name') || el?.classList?.contains('dev-pace-in') || el?.classList?.contains('dev-par-in')) {
      const r = el.dataset.r;
      const i = Number(el.dataset.i);
      state.devs = state.devs || { BE: [], FE: [] };
      while (state.devs[r].length <= i) state.devs[r].push({ name: null, pace: null, par: null });
      const row = state.devs[r][i];
      const num = el.value === '' ? null : Number(el.value);
      if (el.classList.contains('dev-name')) row.name = el.value.trim() || null;
      else if (el.classList.contains('dev-par-in')) row.par = num;
      else row.pace = num;
      state.devs = normDevs(state.devs);
      change(false);
    }
  });

  html('team', renderTeam(R));
  html('sp-cfg', renderSprintSettings(R));
  render();

  return {
    refresh: render,
    setStatus(msg, kind) {
      const el = $('refresh-status');
      if (el) {
        el.textContent = msg;
        el.className = 'r-status' + (kind ? ' ' + kind : '');
      }
    },
    R
  };
}
