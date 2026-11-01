// Fills the sections of the roadmap page and wires its controls. The page frame
// (src/render/page.js) is painted once; every control change re-renders the
// sections in place by id, so the scroll position and open panels survive.
import { createEnv } from '../render/env.js';
import { renderEpics } from '../render/epics.js';
import { renderFlow } from '../render/flow.js';
import { renderGantt } from '../render/gantt.js';
import { computeSummary, legendHTML, renderKpis, renderWhatIf } from '../render/kpis.js';
import { renderNotes } from '../render/notes.js';
import { renderOverview } from '../render/overview.js';
import { renderOwners } from '../render/owners.js';
import { renderPeople } from '../render/people.js';
import { renderRaw } from '../render/raw.js';
import { renderSprints } from '../render/sprints.js';
import { renderTeam } from '../render/team.js';
import { renderVelocity } from '../render/velocity.js';
import { normDevs, normOwn } from '../roadmapState.js';
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
    const sp = renderSprints(R, P, crit);
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
    text('par-n', R.fa(state.par, 0));
  }

  // the team panel is rebuilt only when its row count or placeholder pace changes, never while someone types in it
  const change = (rebuildTeam = true) => {
    persist();
    if (rebuildTeam) html('team', renderTeam(R));
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

  // controls: delegated on the document itself (the page is rewritten by document.write on a repaint)
  doc.addEventListener('click', (e) => {
    const t = e.target?.closest?.('button');
    if (!t) return;
    const m = /^(be|fe|par)-(inc|dec)$/.exec(t.id || '');
    if (m) {
      state[m[1]] = clamp(state[m[1]] + (m[2] === 'inc' ? 1 : -1));
      change();
    } else if (t.id === 'refresh-btn') onRefresh();
  });
  doc.addEventListener('change', (e) => {
    const el = e.target;
    if (el?.name === 'pace') {
      state.pace = el.value;
      change();
    } else if (/^opt-(p2|p3|def|hist)$/.test(el?.id || '')) {
      state[el.id.slice(4)] = !!el.checked;
      change(false);
    } else if (el?.classList?.contains('dev-name') || el?.classList?.contains('dev-pace-in')) {
      const r = el.dataset.r;
      const i = Number(el.dataset.i);
      state.devs = state.devs || { BE: [], FE: [] };
      while (state.devs[r].length <= i) state.devs[r].push({ name: null, pace: null });
      const row = state.devs[r][i];
      if (el.classList.contains('dev-name')) row.name = el.value.trim() || null;
      else row.pace = el.value === '' ? null : Number(el.value);
      state.devs = normDevs(state.devs);
      change(false);
    }
  });

  html('team', renderTeam(R));
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
