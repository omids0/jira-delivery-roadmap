// The sprint that is running now: what it holds and how far it is. Built from the
// issues Jira lists on the active sprint (Agile REST), not from the plan. Pure.
import { roleOf } from './model.js';
import { workdaysBetween } from './sprints.js';

const category = (i) => i.fields.status?.statusCategory?.key; // 'new' | 'indeterminate' | 'done'

const tally = (list) => ({
  total: list.length,
  done: list.filter((i) => category(i) === 'done').length,
  doing: list.filter((i) => category(i) === 'indeterminate').length,
  todo: list.filter((i) => category(i) !== 'done' && category(i) !== 'indeterminate').length
});

/**
 * @param {object} sprint   Agile sprint { name, startDate, endDate }
 * @param {object[]} issues raw issues of the sprint (all types)
 * @param {{ cfg: object, today: Date, weekend: number[], epicField: string|null, epicName: (key: string) => string|null }} o
 */
export function summarizeSprint(sprint, issues, { cfg, today, weekend, epicField, epicName }) {
  const storyTypes = (cfg.issueTypes?.story?.length ? cfg.issueTypes.story : ['Story']).map((s) => String(s).toLowerCase());
  const kind = (i) => {
    const t = i.fields.issuetype;
    if (t?.subtask) return 'sub';
    if (/^epic$/i.test(t?.name || '')) return 'epic';
    return storyTypes.includes(String(t?.name).toLowerCase()) ? 'story' : 'other';
  };
  const stories = issues.filter((i) => kind(i) === 'story');
  const subs = issues.filter((i) => kind(i) === 'sub');
  const other = issues.filter((i) => kind(i) === 'other');

  // sub-task progress per story and per role
  const byParent = {};
  const role = { be: [], fe: [] };
  for (const s of subs) {
    const p = s.fields.parent?.key;
    if (p) (byParent[p] = byParent[p] || []).push(s);
    role[roleOf(s.fields, cfg)].push(s);
  }

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const total = Math.max(1, workdaysBetween(startDay, new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1), weekend));
  const elapsed = Math.min(total, Math.max(0, workdaysBetween(startDay, tomorrow, weekend)));

  const sTally = tally(stories);
  const subTally = tally(subs);
  const basis = subTally.total ? subTally : sTally; // sub-tasks are the finer measure of progress
  const timePct = Math.round((100 * elapsed) / total);
  const donePct = basis.total ? Math.round((100 * basis.done) / basis.total) : 0;
  const diff = donePct - timePct;

  const groups = new Map();
  for (const s of stories) {
    const e = epicField && typeof s.fields[epicField] === 'string' ? s.fields[epicField] : null;
    if (!groups.has(e)) groups.set(e, { key: e, name: e ? epicName(e) || e : null, items: [] });
    const mine = byParent[s.key] || [];
    groups.get(e).items.push({
      k: s.key, title: s.fields.summary || '', status: s.fields.status?.name || '', cat: category(s) || 'new',
      assignee: s.fields.assignee?.displayName || null, subs: { done: mine.filter((x) => category(x) === 'done').length, total: mine.length }
    });
  }
  const order = { indeterminate: 0, new: 1, done: 2 };
  const epics = [...groups.values()].map((g) => ({
    ...g,
    items: g.items.sort((a, b) => (order[a.cat] ?? 1) - (order[b.cat] ?? 1) || a.k.localeCompare(b.k, 'en', { numeric: true })),
    done: g.items.filter((x) => x.cat === 'done').length
  })).sort((a, b) => (b.items.length - b.done) - (a.items.length - a.done) || (a.key === null) - (b.key === null));

  return {
    name: sprint.name, start: sprint.startDate, end: sprint.endDate,
    days: { total, elapsed, left: total - elapsed },
    stories: sTally, subs: { ...subTally, be: tally(role.be), fe: tally(role.fe) }, other: tally(other),
    timePct, donePct, pace: basis.total ? (diff >= 10 ? 'ahead' : diff <= -10 ? 'behind' : 'on') : null,
    epics
  };
}
