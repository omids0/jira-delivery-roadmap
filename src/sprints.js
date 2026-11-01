// Sprint history -> measured team output. `fetchSprints` reads the Scrum
// boards of a project; `deriveSprints` (pure) turns closed sprints plus the
// project's sub-tasks into { be, fe, beHeads, feHeads, wd, planned, stories }
// per sprint, the numbers the pace calibration needs.
import { jiraGet } from './jiraClient.js';

const day = (iso) => (iso ? String(iso).slice(0, 10) : null);

/** All sprints of the project's Scrum boards: [{ id, name, state, startDate, endDate, completeDate }]. */
export async function fetchSprints(session, key) {
  let boards = [];
  try {
    const r = await jiraGet(session, `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(key)}&type=scrum&maxResults=50`);
    boards = r.values || [];
  } catch {
    return []; // no Jira Software, or no access to the agile API: the plan falls back to the default pace
  }
  const seen = new Map();
  for (const b of boards) {
    for (let start = 0; start < 500;) {
      let page;
      try {
        page = await jiraGet(session, `/rest/agile/1.0/board/${b.id}/sprint?state=closed,active,future&startAt=${start}&maxResults=50`);
      } catch {
        break;
      }
      for (const s of page.values || []) if (!seen.has(s.id)) seen.set(s.id, s);
      start += (page.values || []).length;
      if (page.isLast || !(page.values || []).length) break;
    }
  }
  return [...seen.values()];
}

const trailingNumber = (name) => {
  const m = /(\d+)\s*$/.exec(name || '');
  return m ? Number(m[1]) : null;
};

/** Workdays in [from, to) given getDay() numbers of the weekend. */
export function workdaysBetween(from, to, weekend) {
  let n = 0;
  for (const d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d < to; d.setDate(d.getDate() + 1)) {
    if (!weekend.includes(d.getDay())) n++;
  }
  return n;
}

/**
 * @param {object[]} sprints   from fetchSprints
 * @param {{ subtasks: object[], stories: object[] }} data  normalized: subtasks {role, done, resolved, assignee}, stories {done, resolved}
 * @param {{ weekend: number[], lastN?: number }} opts
 */
export function deriveSprints(sprints, data, { weekend, lastN = 4 }) {
  const closed = sprints
    .filter((s) => s.state === 'closed' && s.startDate && (s.completeDate || s.endDate))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(-lastN);

  return closed.map((s) => {
    const from = new Date(s.startDate);
    const to = new Date(s.completeDate || s.endDate);
    const inWin = (iso) => {
      const t = iso ? new Date(iso) : null;
      return t && t >= from && t <= to;
    };
    const heads = { be: new Set(), fe: new Set() };
    const out = { be: 0, fe: 0 };
    for (const t of data.subtasks) {
      if (!t.done || !inWin(t.resolved)) continue;
      out[t.role]++;
      if (t.assignee) heads[t.role].add(t.assignee);
    }
    const planned = workdaysBetween(from, new Date(s.endDate || s.completeDate), weekend);
    return {
      n: s.name,
      start: day(s.startDate),
      complete: day(s.completeDate || s.endDate),
      planned,
      wd: Math.max(1, workdaysBetween(from, to, weekend)),
      stories: data.stories.filter((x) => x.done && inWin(x.resolved)).length,
      be: out.be,
      fe: out.fe,
      beHeads: Math.max(1, heads.be.size),
      feHeads: Math.max(1, heads.fe.size)
    };
  }).filter((s) => s.be + s.fe > 0);
}

/**
 * Where the proposal starts: right after the active sprint, else after the last closed one, else today.
 * @returns {{ n: number, start: string, len: number, firstLen: number, sprintWord: string, marks: [string, string][] }}
 */
export function nextSprint(sprints, { today, len = 10 }) {
  const byStart = [...sprints].filter((s) => s.startDate).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const active = byStart.find((s) => s.state === 'active');
  const closed = byStart.filter((s) => s.state === 'closed');
  const ref = active || closed[closed.length - 1] || null;
  const todayIso = day(today.toISOString());
  const endIso = active?.endDate ? day(active.endDate) : null;
  return {
    n: ref ? (trailingNumber(ref.name) ?? byStart.length) + 1 : 1,
    start: endIso && endIso > todayIso ? endIso : todayIso,
    len,
    firstLen: len,
    sprintWord: ref ? String(ref.name).replace(/\s*\d+\s*$/, '').trim() || 'Sprint' : 'Sprint',
    marks: byStart.filter((s) => s.state !== 'future').map((s) => [s.name, day(s.startDate)])
  };
}
