// Reads the raw issues of one project from Jira. Network only; shaping the
// result is src/model.js.
import { getEpicLinkField, jqlQuote, jqlSearchAll } from './jiraClient.js';
import { fetchSprints } from './sprints.js';

/**
 * @param {object} session  { baseUrl, token, meta }
 * @param {string} key      validated project key
 * @param {object} cfg      merged project config
 * @param {(text: string) => void} [onProgress]
 */
export async function fetchProject(session, key, cfg, onProgress = () => {}) {
  const epicField = await getEpicLinkField(session);
  const storyTypes = (cfg.issueTypes?.story?.length ? cfg.issueTypes.story : ['Story']).map(jqlQuote).join(', ');
  const base = ['summary', 'status', 'labels', 'components', 'assignee', 'resolutiondate'];

  onProgress('در حال خواندن اپیک‌ها، استوری‌ها و ساب‌تسک‌ها…');
  const [epics, stories, subtasks, assigned, sprints] = await Promise.all([
    jqlSearchAll(session, `project = ${key} AND issuetype = Epic`, ['summary', 'status']),
    jqlSearchAll(session, `project = ${key} AND issuetype in (${storyTypes})`, [...base, 'issuelinks', ...(epicField ? [epicField] : [])]),
    jqlSearchAll(session, `project = ${key} AND issuetype in subTaskIssueTypes()`, [...base, 'parent']),
    fetchAssigned(session, key, epicField),
    fetchSprints(session, key)
  ]);
  return { epics, stories, subtasks, epicField, assigned, sprints };
}

/** Open work items that have an assignee (tasks, bugs, stories, sub-tasks), for the per-person view. */
export function fetchAssigned(session, key, epicField) {
  const fields = ['summary', 'status', 'issuetype', 'assignee', 'parent', 'priority', 'updated', ...(epicField ? [epicField] : [])];
  return jqlSearchAll(session, `project = ${key} AND assignee is not EMPTY AND statusCategory != Done AND issuetype != Epic`, fields);
}
