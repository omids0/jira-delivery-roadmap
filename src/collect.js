// Reads the raw issues of one project from Jira. Network only; shaping the
// result is src/model.js.
import { getEpicLinkField, jqlQuote, jqlSearchAll } from './jiraClient.js';

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
  const [epics, stories, subtasks] = await Promise.all([
    jqlSearchAll(session, `project = ${key} AND issuetype = Epic`, ['summary', 'status']),
    jqlSearchAll(session, `project = ${key} AND issuetype in (${storyTypes})`, [...base, 'issuelinks', ...(epicField ? [epicField] : [])]),
    jqlSearchAll(session, `project = ${key} AND issuetype in subTaskIssueTypes()`, [...base, 'parent'])
  ]);
  return { epics, stories, subtasks, epicField };
}
