// Time model from the worklogs people logged in past sprints. Pure.
//
//  - hours per sub-task: the average time spent on the sub-tasks that were closed in the window (per role)
//  - hours per day: how many hours each person logs on the days they logged (per person, per role)
//  - pace (sub-tasks per person-day) = hours per day / hours per sub-task
// The planner can use this pace instead of the one counted from sprint velocity.
import { roleOf } from './model.js';

const MIN_SUBTASKS = 5; // closed sub-tasks with time spent needed per role
const MIN_DAYS = 3; // days with a worklog needed per person
const DAY = 86400000;

/** The period the averages are taken over: the last closed sprints, else the last 60 days. */
export function worklogWindow(sprints, now, lastN = 4) {
  const closed = sprints
    .filter((s) => s.state === 'closed' && s.startDate && (s.completeDate || s.endDate))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(-lastN);
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  if (!closed.length) return { since: iso(now.getTime() - 60 * DAY), until: iso(now) };
  return { since: iso(closed[0].startDate), until: iso(closed[closed.length - 1].completeDate || closed[closed.length - 1].endDate) };
}

const stat = (xs) => {
  if (!xs.length) return { n: 0, avg: 0, median: 0, total: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const total = xs.reduce((a, b) => a + b, 0);
  const mid = Math.floor(s.length / 2);
  return { n: xs.length, avg: total / xs.length, median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2, total };
};

/**
 * @param {object} o
 * @param {object[]} o.subtasks        raw sub-tasks (fields.timespent in seconds, status, resolutiondate, components, labels)
 * @param {object[]} o.worklogIssues   raw issues with fields.worklog.worklogs [{ author, started, timeSpentSeconds }]
 * @param {{ since: string, until: string }} o.window  'YYYY-MM-DD'
 * @param {number[]} o.weekend         getDay() numbers; logs on those days are ignored
 * @param {object} o.cfg
 * @param {(name: string) => 'be'|'fe'} o.roleOfName   role of a person
 */
export function summarizeWorklogs({ subtasks, worklogIssues, window: w, weekend, cfg, roleOfName }) {
  const inWindow = (iso) => {
    const d = String(iso || '').slice(0, 10);
    return d >= w.since && d <= w.until;
  };

  // hours per sub-task, per role
  const hours = { be: [], fe: [] };
  for (const t of subtasks) {
    const spent = Number(t.fields.timespent);
    if (t.fields.status?.statusCategory?.key !== 'done' || !(spent > 0) || !inWindow(t.fields.resolutiondate)) continue;
    hours[roleOf(t.fields, cfg)].push(spent / 3600);
  }
  const perSubtask = { be: stat(hours.be), fe: stat(hours.fe) };

  // hours per day, per person: only days on which the person logged something, weekends left out
  const seconds = new Map();
  for (const issue of worklogIssues || []) {
    for (const l of issue.fields?.worklog?.worklogs || []) {
      const day = String(l.started || '').slice(0, 10);
      const name = l.author?.displayName;
      if (!name || !inWindow(day) || !(l.timeSpentSeconds > 0)) continue;
      if (weekend.includes(new Date(`${day}T12:00:00`).getDay())) continue;
      const m = seconds.get(name) || new Map();
      m.set(day, (m.get(day) || 0) + l.timeSpentSeconds);
      seconds.set(name, m);
    }
  }
  const people = {};
  const roleTotals = { be: { h: 0, d: 0, people: 0 }, fe: { h: 0, d: 0, people: 0 } };
  for (const [name, byDay] of seconds) {
    const days = byDay.size;
    if (days < MIN_DAYS) continue;
    const h = [...byDay.values()].reduce((a, b) => a + b, 0) / 3600;
    const role = roleOfName(name);
    people[name] = { role, hours: h, days, perDay: h / days };
    roleTotals[role].h += h;
    roleTotals[role].d += days;
    roleTotals[role].people++;
  }
  const perDay = { be: roleTotals.be.d ? roleTotals.be.h / roleTotals.be.d : 0, fe: roleTotals.fe.d ? roleTotals.fe.h / roleTotals.fe.d : 0 };

  // pace: sub-tasks per person per workday
  const paceOf = (role, hoursPerDay) => (perSubtask[role].n >= MIN_SUBTASKS && perSubtask[role].avg > 0 && hoursPerDay > 0 ? hoursPerDay / perSubtask[role].avg : null);
  const pace = { BE: paceOf('be', perDay.be), FE: paceOf('fe', perDay.fe) };
  for (const p of Object.values(people)) p.pace = paceOf(p.role, p.perDay);

  return {
    window: w, perSubtask, perDay, roles: roleTotals, people,
    pace: pace.BE || pace.FE ? pace : null, // null: not enough logged time to say anything
    partial: !!(pace.BE && !pace.FE) || !!(!pace.BE && pace.FE),
    minSubtasks: MIN_SUBTASKS, minDays: MIN_DAYS
  };
}
