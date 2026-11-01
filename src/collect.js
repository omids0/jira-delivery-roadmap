// Reads the raw issues of one project from Jira. Network only; shaping the
// result is src/model.js.
import { getEpicLinkField, jiraGet, jqlQuote, jqlSearchAll } from './jiraClient.js';
import { fetchSprintIssues, fetchSprints } from './sprints.js';
import { worklogWindow } from './worklog.js';

/**
 * @param {object} session  { baseUrl, token, meta }
 * @param {string} key      validated project key
 * @param {object} cfg      merged project config
 * @param {(text: string) => void} [onProgress]
 */
export async function fetchProject(session, key, cfg, onProgress = () => {}) {
  const epicField = await getEpicLinkField(session);
  const storyTypes = (cfg.issueTypes?.story?.length ? cfg.issueTypes.story : ['Story']).map(jqlQuote).join(', ');
  const base = ['summary', 'status', 'labels', 'components', 'assignee', 'resolutiondate', 'timespent'];

  onProgress('در حال خواندن اپیک‌ها، استوری‌ها و ساب‌تسک‌ها…');
  const [epics, stories, subtasks, assigned, sprints] = await Promise.all([
    jqlSearchAll(session, `project = ${key} AND issuetype = Epic`, ['summary', 'status']),
    jqlSearchAll(session, `project = ${key} AND issuetype in (${storyTypes})`, [...base, 'issuelinks', ...(epicField ? [epicField] : [])]),
    jqlSearchAll(session, `project = ${key} AND issuetype in subTaskIssueTypes()`, [...base, 'parent']),
    fetchAssigned(session, key, epicField),
    fetchSprints(session, key)
  ]);
  // what the running sprint holds, straight from Jira
  const active = sprints.find((s) => s.state === 'active');
  const activeSprint = active
    ? { sprint: active, issues: await fetchSprintIssues(session, active.id, ['summary', 'status', 'issuetype', 'assignee', 'labels', 'components', 'parent', ...(epicField ? [epicField] : [])]) }
    : null;
  // logged time of the last sprints: the basis of the "estimate from worklogs"
  const worklogIssues = await fetchWorklogIssues(session, key, worklogWindow(sprints, new Date()).since);
  return { epics, stories, subtasks, epicField, assigned, sprints, activeSprint, worklogIssues };
}

/**
 * Issues that have worklogs since a date, each with its complete worklog list.
 * null when Jira refuses (time tracking off, no access): the plan then falls back to sprint velocity.
 */
export async function fetchWorklogIssues(session, key, since) {
  let issues;
  try {
    issues = await jqlSearchAll(session, `project = ${key} AND worklogDate >= "${since}"`, ['worklog']);
  } catch {
    return null;
  }
  // the search embeds only the first worklogs of an issue; read the rest of the busiest ones
  let extra = 0;
  for (const i of issues) {
    const wl = i.fields?.worklog;
    if (wl && wl.total > (wl.worklogs || []).length && extra < 150) {
      extra++;
      try {
        const r = await jiraGet(session, `/rest/api/2/issue/${i.key}/worklog`);
        i.fields.worklog = { ...wl, worklogs: r.worklogs || wl.worklogs };
      } catch {
        // keep what the search returned
      }
    }
  }
  return issues;
}

/** Open work items that have an assignee (tasks, bugs, stories, sub-tasks), for the per-person view. */
export function fetchAssigned(session, key, epicField) {
  const fields = ['summary', 'status', 'issuetype', 'assignee', 'parent', 'priority', 'updated', ...(epicField ? [epicField] : [])];
  return jqlSearchAll(session, `project = ${key} AND assignee is not EMPTY AND statusCategory != Done AND issuetype != Epic`, fields);
}
