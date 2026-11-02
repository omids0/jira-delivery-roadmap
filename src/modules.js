// Progress per module: Done / In Progress / Backlog counts of the stories, grouped by
// the module code in the story title (default `US-XXX-nn` -> XXX), by epic, or all together.
// Pure: works on the normalized model.
const OTHER = 'سایر';

/**
 * "True" state of a story. Done only when its own status says Done, or when it is in progress and every
 * back-end and front-end sub-task is Done (the story status often lags behind). A story that has back-end
 * sub-tasks but no front-end ones is not finished: the front-end has simply not started.
 * @returns {'done'|'inprogress'|'backlog'}
 */
export function trueState(s) {
  if (s.category === 'done' || (s.category == null && s.done)) return 'done';
  if (s.category === 'new') return 'backlog';
  const { be, fe } = s.subtasks;
  if (be.total + fe.total > 0 && fe.total > 0 && fe.open === 0 && be.open === 0) return 'done';
  return 'inprogress';
}

/**
 * @param {{ stories: object[], epics: object[] }} model
 * @param {{ moduleBy?: 'auto'|'prefix'|'epic'|'none', modulePattern?: string, moduleLabels?: object, labels?: object }} cfg
 * @returns {{ mode: string, modules: {id,label,done,inProgress,backlog,total}[], totals: object }}
 */
export function buildModules(model, cfg) {
  const cancelled = cfg.labels?.cancelled ?? ['cancelled'];
  const stories = model.stories.filter((s) => !(s.labels || []).some((l) => cancelled.includes(l)));
  let pattern;
  try {
    pattern = new RegExp(cfg.modulePattern || 'US-([A-Z]+)-\\d+');
  } catch {
    pattern = /US-([A-Z]+)-\d+/;
  }
  const prefixOf = (s) => pattern.exec(s.title)?.[1] || null;
  const names = Object.fromEntries(model.epics.map((e) => [e.key, e.name]));
  const labels = cfg.moduleLabels || {};

  let mode = cfg.moduleBy || 'auto';
  if (mode === 'auto') {
    const matched = stories.filter(prefixOf).length;
    if (stories.length > 0 && matched / stories.length >= 0.5) mode = 'prefix';
    else mode = stories.some((s) => s.epic) ? 'epic' : 'none';
  }
  if (mode === 'epic' && !stories.some((s) => s.epic)) mode = 'none';

  const moduleOf = (s) => {
    if (mode === 'prefix') {
      const id = prefixOf(s) || OTHER;
      return { id, label: labels[id] || id };
    }
    if (mode === 'epic') {
      return s.epic ? { id: s.epic, label: labels[s.epic] || names[s.epic] || s.epic } : { id: 'NO_EPIC', label: 'بدون اپیک' };
    }
    return { id: 'ALL', label: 'همه' };
  };

  const byId = {};
  const of = {}; // story key -> its module { id, label }
  const totals = { done: 0, inProgress: 0, backlog: 0, total: 0 };
  for (const s of stories) {
    const { id, label } = moduleOf(s);
    of[s.key] = { id, label };
    const m = (byId[id] = byId[id] || { id, label, done: 0, inProgress: 0, backlog: 0, total: 0 });
    const state = trueState(s);
    const key = state === 'done' ? 'done' : state === 'inprogress' ? 'inProgress' : 'backlog';
    m[key]++;
    m.total++;
    totals[key]++;
    totals.total++;
  }
  // biggest first; equal sizes keep the order the modules were first met in, the catch-all group last
  const modules = Object.values(byId).sort((a, b) => b.total - a.total || (a.id === OTHER) - (b.id === OTHER));
  return { mode, modules, totals, of };
}
