// Turns raw Jira REST issues into the planning model. Pure functions: no DOM,
// no network. `cfg` is the merged project config (config/projects.json + the
// user's saved settings).

const FE_SUMMARY_HINT = /فرانت|front|UI|پنل|صفحه|i18n/i;

const isDone = (fields) => fields?.status?.statusCategory?.key === 'done';
const names = (list) => (list || []).map((x) => String(x?.name ?? x).toLowerCase());

/** 'be' | 'fe' for one sub-task: component first, then label, then a guess from the title. */
export function roleOf(fields, cfg) {
  const comps = names(fields.components);
  const labels = names(fields.labels);
  const inComponent = (name) => !!name && comps.some((c) => c.includes(String(name).toLowerCase()));
  const hasLabel = (list) => (list || []).some((l) => labels.includes(String(l).toLowerCase()));

  if (inComponent(cfg.components?.be)) return 'be';
  if (inComponent(cfg.components?.fe)) return 'fe';
  if (hasLabel(cfg.labels?.be)) return 'be';
  if (hasLabel(cfg.labels?.fe)) return 'fe';
  return FE_SUMMARY_HINT.test(fields.summary || '') ? 'fe' : 'be';
}

const isBlockLink = (type, cfg) => {
  const re = new RegExp(cfg.blockLinkPattern || 'block', 'i');
  return [type?.name, type?.inward, type?.outward].some((s) => s && re.test(s));
};

/** key -> Map(blocker key -> blocker is done), from the "blocks / is blocked by" links of the stories. */
function collectBlockers(stories, cfg) {
  const blockedBy = new Map();
  const add = (key, blocker, done) => {
    if (!blockedBy.has(key)) blockedBy.set(key, new Map());
    blockedBy.get(key).set(blocker, done);
  };
  for (const issue of stories) {
    for (const link of issue.fields.issuelinks || []) {
      if (!isBlockLink(link.type, cfg)) continue;
      // Seen from this issue: an inward end means "this is blocked by it", an outward end means "this blocks it".
      if (link.inwardIssue) add(issue.key, link.inwardIssue.key, isDone(link.inwardIssue.fields));
      if (link.outwardIssue) add(link.outwardIssue.key, issue.key, isDone(issue.fields));
    }
  }
  return blockedBy;
}

const epicOf = (fields, epicField) => {
  const v = epicField ? fields[epicField] : null;
  return typeof v === 'string' && v ? v : null;
};

/**
 * @param {{ epics: object[], stories: object[], subtasks: object[], epicField: string|null }} raw
 * @param {object} cfg
 */
export function buildModel({ epics, stories, subtasks, epicField }, cfg) {
  const subs = new Map();
  for (const s of subtasks) {
    const parent = s.fields.parent?.key;
    if (!parent) continue;
    const entry = subs.get(parent) || { be: { open: 0, total: 0 }, fe: { open: 0, total: 0 } };
    const role = roleOf(s.fields, cfg);
    entry[role].total++;
    if (!isDone(s.fields)) entry[role].open++;
    subs.set(parent, entry);
  }

  const storyKeys = new Set(stories.map((i) => i.key));
  const blockers = collectBlockers(stories, cfg);

  const storyList = stories.map((i) => {
    const mine = blockers.get(i.key) || new Map();
    const inProject = [];
    const external = [];
    for (const [k, done] of mine) (storyKeys.has(k) ? inProject : external).push({ key: k, done });
    return {
      key: i.key,
      title: i.fields.summary || '',
      epic: epicOf(i.fields, epicField),
      done: isDone(i.fields),
      status: i.fields.status?.name || '',
      labels: i.fields.labels || [],
      assignee: i.fields.assignee?.displayName || null,
      resolved: i.fields.resolutiondate || null,
      subtasks: subs.get(i.key) || { be: { open: 0, total: 0 }, fe: { open: 0, total: 0 } },
      blockedBy: inProject.map((b) => b.key),
      externalBlockers: external
    };
  });

  return {
    epics: epics.map((e) => ({ key: e.key, name: e.fields.summary || e.key, done: isDone(e.fields) })),
    stories: storyList
  };
}

const keyNum = (k) => Number(String(k).split('-').pop()) || 0;

/** Counts for the overview and the data-quality warnings. */
export function summarize(model) {
  const open = model.stories.filter((s) => !s.done);
  const total = (s) => s.subtasks.be.total + s.subtasks.fe.total;

  const rows = new Map();
  const rowFor = (key) => {
    if (!rows.has(key)) {
      const e = model.epics.find((x) => x.key === key);
      rows.set(key, { key, name: e?.name ?? (key ? key : null), openStories: 0, doneStories: 0, be: { open: 0, total: 0 }, fe: { open: 0, total: 0 } });
    }
    return rows.get(key);
  };
  for (const s of model.stories) {
    const r = rowFor(s.epic);
    if (s.done) r.doneStories++;
    else r.openStories++;
    for (const role of ['be', 'fe']) {
      r[role].open += s.subtasks[role].open;
      r[role].total += s.subtasks[role].total;
    }
  }

  return {
    open: open.length,
    done: model.stories.length - open.length,
    noEpic: open.filter((s) => !s.epic).length,
    noSubtasks: open.filter((s) => total(s) === 0).length,
    withBlockers: open.filter((s) => s.blockedBy.length || s.externalBlockers.length).length,
    externalOpen: open.filter((s) => s.externalBlockers.some((b) => !b.done)).length,
    epics: [...rows.values()]
      .filter((r) => r.openStories + r.doneStories > 0)
      .sort((a, b) => (a.key === null) - (b.key === null) || keyNum(a.key) - keyNum(b.key))
  };
}
