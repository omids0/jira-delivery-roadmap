// Shapes live Jira data into the planning context the engine and the renderers
// use (the same shapes the original hand-built roadmap used). Pure.
import { roleOf } from './model.js';
import { summarizeSprint } from './currentSprint.js';
import { deriveSprints, nextSprint } from './sprints.js';

export const KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

const DEFAULT_LABELS = {
  decision: ['needs-decision'], deferred: ['deferred'], phase2: ['phase-2'], phase3: ['phase-3'], cancelled: ['cancelled'],
  fe: ['admin-panel', 'storefront', 'frontend-change', 'frontend', 'ui'], feOnly: ['frontend-change', 'frontend'], be: ['backend']
};

const isoDay = (iso) => (iso ? String(iso).slice(0, 10) : null);
const keyNum = (k) => Number(String(k).split('-').pop()) || 0;
const hasAny = (lb, arr) => (lb || []).some((l) => (arr || []).includes(l));
const cleanTitle = (t) => String(t || '').replace(/^\[[^\]]*\]\s*/, '').trim();

/**
 * @param {object} input
 * @param {object} input.raw      { epics, stories, subtasks, epicField } from collect.fetchProject
 * @param {object} input.model    buildModel(raw, cfg)
 * @param {object[]} input.sprints   fetchSprints result
 * @param {object[]} input.assigned  raw open issues that have an assignee
 * @param {object} input.cfg      merged project config + saved settings
 * @param {string} input.baseUrl  Jira origin + context path
 * @param {string} input.project  project key
 * @param {Date} input.now
 */
export function buildContext({ raw, model, sprints, assigned, cfg, baseUrl, project, now }) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const LBL = { ...DEFAULT_LABELS, ...(cfg.labels || {}) };
  const est = { be: cfg.estimates?.be ?? 5, fe: cfg.estimates?.fe ?? 4 };
  const recentMs = (cfg.recentDoneDays ?? 14) * 86400000;

  // epics that have stories, in key order; each gets a short code and a colour slot
  const usedKeys = [...new Set(model.stories.map((s) => s.epic).filter(Boolean))].sort((a, b) => keyNum(a) - keyNum(b));
  const nameOf = Object.fromEntries(model.epics.map((e) => [e.key, e.name]));
  const EP = { oth: { k: null, n: 'سایر / بدون اپیک', t: 0 } };
  const codeOf = {};
  usedKeys.forEach((k, i) => {
    codeOf[k] = 'e' + (i + 1);
    EP[codeOf[k]] = { k, n: nameOf[k] || k, t: (i % 8) + 1 };
  });
  const EP_ORDER = [...usedKeys.map((k) => codeOf[k]), 'oth'];

  const stories = [];
  const byKey = Object.fromEntries(model.stories.map((s) => [s.key, s]));
  const rawByKey = Object.fromEntries(raw.stories.map((i) => [i.key, i]));
  for (const s of model.stories) {
    if (hasAny(s.labels, LBL.cancelled)) continue;
    const feOnly = hasAny(s.labels, LBL.feOnly) && !hasAny(s.labels, LBL.be);
    const wantsFe = hasAny(s.labels, LBL.fe) || feOnly;
    const f = [];
    const category = rawByKey[s.key]?.fields?.status?.statusCategory?.key;
    if (!s.done && category === 'indeterminate') f.push('ip');
    if (hasAny(s.labels, LBL.decision)) f.push('d');
    if (hasAny(s.labels, LBL.deferred)) f.push('def');
    if (hasAny(s.labels, LBL.phase2)) f.push('p2');
    if (hasAny(s.labels, LBL.phase3)) f.push('p3');
    if (s.externalBlockers.some((b) => !b.done)) f.push('ext');
    const known = {};
    if (s.subtasks.be.total > 0) known.be = s.subtasks.be.open;
    if (s.subtasks.fe.total > 0) known.fe = s.subtasks.fe.open;
    const resolvedAt = s.resolved ? new Date(s.resolved) : null;
    stories.push({
      k: s.key, ep: s.epic ? codeOf[s.epic] : 'oth', title: cleanTitle(s.title),
      be: feOnly ? 0 : est.be, fe: wantsFe ? est.fe : 0,
      deps: s.blockedBy.slice(), f, known, subs: s.subtasks,
      done: s.done, res: isoDay(s.resolved),
      hist: s.done && (!resolvedAt || today - resolvedAt > recentMs)
    });
  }

  // dependency verdicts for the flow chart: ready = nothing open upstream, blocked otherwise
  const DEP_INFO = {};
  for (const s of stories) {
    const open = s.deps.filter((d) => byKey[d] && !byKey[d].done);
    const ext = (byKey[s.k]?.externalBlockers || []).filter((b) => !b.done).map((b) => b.key);
    DEP_INFO[s.k] = { v: open.length || ext.length ? 'blocked' : 'ready', d: s.f.includes('d') ? [s.k] : [], x: ext, n: null, soft: [] };
  }

  // sub-tasks and stories reduced to what the sprint statistics need
  const subNorm = raw.subtasks.map((t) => ({
    role: roleOf(t.fields, cfg), done: t.fields.status?.statusCategory?.key === 'done',
    resolved: t.fields.resolutiondate || null, assignee: t.fields.assignee?.displayName || null, open: t.fields.status?.statusCategory?.key !== 'done'
  }));
  const storyNorm = model.stories.map((s) => ({ done: s.done, resolved: s.resolved }));
  const weekend = cfg.weekend || [4, 5];
  const SPRINTS = deriveSprints(sprints, { subtasks: subNorm, stories: storyNorm }, { weekend });
  const NEXT_SPRINT = { ...nextSprint(sprints, { today, len: 10 }) };
  if (cfg.sprintTarget) NEXT_SPRINT.target = cfg.sprintTarget;
  const { marks: SPRINT_MARKS, sprintWord } = NEXT_SPRINT;
  delete NEXT_SPRINT.marks;
  delete NEXT_SPRINT.sprintWord;

  const locale = cfg.locale || 'fa-IR-u-ca-persian';
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  SPRINTS.forEach((sp) => {
    sp.from = fmt.format(new Date(sp.start));
    sp.to = fmt.format(new Date(sp.complete));
  });

  // people: configured, else the most active assignees of sub-tasks per role
  let people = cfg.people;
  if (!Array.isArray(people) || !people.length) {
    people = [];
    // someone with sub-tasks in both roles is listed once, in the role where they do more
    const tally = {};
    subNorm.filter((t) => t.assignee).forEach((t) => {
      const c = (tally[t.assignee] = tally[t.assignee] || { be: 0, fe: 0 });
      c[t.role]++;
    });
    for (const role of ['be', 'fe']) {
      Object.entries(tally)
        .filter(([, c]) => (role === 'be' ? c.be >= c.fe : c.fe > c.be))
        .sort((a, b) => b[1][role] - a[1][role])
        .slice(0, 6)
        .forEach(([name], i) => people.push({ role: role.toUpperCase(), n: i + 1, name, jira: [name] }));
    }
  }

  // every Jira person seen on the project's sub-tasks and open work, most active first (the pick-list for team members)
  const seen = {};
  subNorm.forEach((t) => t.assignee && (seen[t.assignee] = (seen[t.assignee] || 0) + 1));
  assigned.forEach((i) => i.fields.assignee?.displayName && (seen[i.fields.assignee.displayName] = (seen[i.fields.assignee.displayName] || 0) + 1));
  const assignees = Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const ASSIGNED = assigned.map((i) => {
    const e = raw.epicField ? i.fields[raw.epicField] : null;
    return [
      i.key, i.fields.issuetype?.name || '', i.fields.summary || '', i.fields.status?.name || '', i.fields.status?.statusCategory?.name || '',
      i.fields.assignee?.displayName || '', i.fields.parent?.key || null, typeof e === 'string' ? e : null, i.fields.priority?.name || '', isoDay(i.fields.updated) || ''
    ];
  });

  const CURRENT_SPRINT = raw.activeSprint?.issues?.length
    ? summarizeSprint(raw.activeSprint.sprint, raw.activeSprint.issues, { cfg, today, weekend, epicField: raw.epicField, epicName: (k) => nameOf[k] || null })
    : null;

  return {
    project, jiraBase: baseUrl, locale, weekend, today,
    EP, EP_ORDER, stories, DEP_INFO, SPRINTS, SPRINT_MARKS, NEXT_SPRINT, sprintWord,
    priority: { high: [], low: [], holdLow: false, ...(cfg.priority || {}) },
    defaults: { be: est.be, fe: est.fe, storyPace: cfg.storyPace ?? 3.5 },
    defaultPace: { BE: cfg.defaultPace?.BE ?? 12, FE: cfg.defaultPace?.FE ?? 12 },
    team: cfg.team || { be: 1, fe: 1 }, parallel: cfg.parallelStories ?? 3,
    labels: LBL, people, assignees, ASSIGNED, CURRENT_SPRINT
  };
}
