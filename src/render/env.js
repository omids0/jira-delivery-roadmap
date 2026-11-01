// Shared rendering environment `R`: formatters, the planning context and the
// engine, plus the mutable UI `state`. Every renderer takes (R, P, ...) where P
// is the result of engine.plan(state).
import { KEY_RE } from '../adapter.js';

/**
 * @param {object} ctx    from adapter.buildContext
 * @param {object} eng    from engine.createEngine(ctx)
 * @param {object} state  { be, fe, par, pace, p2, p3, def, hist, own: {BE:{}, FE:{}} }
 */
export function createEnv(ctx, eng, state) {
  const { cal } = eng;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fa = (n, d = 1) => Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d });
  const people = ctx.people || [];
  const devName = (r, i) => state.devs?.[r]?.[i]?.name || null;
  const roleName = (r) => (r === 'BE' ? 'بک‌اند' : 'فرانت');
  return {
    ctx, eng, cal, state,
    EP: ctx.EP, EP_ORDER: ctx.EP_ORDER, KEY_RE,
    EP_BY_KEY: Object.fromEntries(Object.entries(ctx.EP).filter(([, e]) => e.k).map(([c, e]) => [e.k, c])),
    PACE: eng.PACE, STORY_PACE: eng.STORY_PACE,
    SPRINTS: ctx.SPRINTS, SPRINT_MARKS: ctx.SPRINT_MARKS, NEXT_SPRINT: ctx.NEXT_SPRINT,
    DEP_INFO: ctx.DEP_INFO, ASSIGNED: ctx.ASSIGNED,
    // team members: the ones the user named replace the auto-detected people of the same slot
    get PEOPLE() {
      const out = people.map((p) => ({ ...p }));
      for (const r of ['BE', 'FE']) {
        for (let i = 0; i < state[r.toLowerCase()]; i++) {
          const name = devName(r, i);
          if (!name) continue;
          const at = out.findIndex((p) => p.role === r && p.n === i + 1);
          const entry = { role: r, n: i + 1, name, jira: [name] };
          if (at >= 0) out[at] = entry;
          else out.push(entry);
        }
      }
      return out;
    },
    LOCALE: ctx.locale, META: { project: ctx.project, sprintWord: ctx.sprintWord, priority: ctx.priority, labels: ctx.labels },
    JIRA: ctx.jiraBase + '/browse/',
    esc, fa, roleName,
    col: (t) => (t ? `var(--s${t})` : 'var(--s0)'),
    kb: (k) => `<bdi class="k">${esc(k)}</bdi>`,
    personName: (r, i) => {
      const own = devName(r, i);
      if (own) return own;
      const p = people.find((x) => x.role === r && x.n === i + 1);
      return p ? p.name : `${roleName(r)} ${fa(i + 1)}`;
    },
    ...cal
  };
}
