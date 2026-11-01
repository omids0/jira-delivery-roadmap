import { JiraError, getMyself, isValidProjectKey, jqlSearchAll, listProjects } from '../jiraClient.js';
import { renderHome, renderProject, renderLoading } from '../render/shell.js';

const LAST_PROJECT_KEY = 'jira-roadmap:last-project:';

/**
 * The roadmap running INSIDE a Jira page (via the bookmarklet). Same origin as
 * Jira, so requests carry the user's logged-in session: no token, no CORS.
 *
 * Current state: scaffold. It logs in, lists projects, and counts open stories
 * per project to prove the pipe works. The planning engine comes next, see
 * docs/DESIGN.md.
 *
 * @param {object} deps
 * @param {{ document: Document }} deps.frame  where pages are painted (an overlay iframe)
 * @param {string} deps.baseUrl                Jira origin + context path
 * @param {(key:string)=>object} deps.projectConfig
 * @param {Storage} deps.storage
 * @param {() => void} deps.onClose
 */
export function createBrowserApp({ frame, baseUrl, projectConfig, storage, onClose }) {
  const session = { baseUrl, token: null, meta: {}, cache: {} };
  const lastKey = LAST_PROJECT_KEY + new URL(baseUrl).host;
  let projects = [];
  let user = '';
  let current = null;
  let seq = 0; // drops answers from a project the user already switched away from

  const paint = (html) => {
    const doc = frame.document;
    // The overlay is gone once the user closed it; late answers have nowhere to go.
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // document.open() drops every listener: bind on the document (events bubble to it).
    doc.addEventListener('change', (e) => {
      if (e.target?.id === 'jr-project') openProject(e.target.value);
    });
    doc.addEventListener('click', (e) => {
      const hit = e.target?.closest?.('#jr-refresh, #jr-close');
      if (hit?.id === 'jr-refresh') openProject(current);
      else if (hit?.id === 'jr-close') onClose();
    });
  };

  function describe(err) {
    if (err instanceof JiraError && err.status === 404) return 'این صفحه متعلق به Jira نیست. بوکمارک را وقتی اجرا کنید که در خود Jira هستید.';
    if (err instanceof JiraError && err.status === 401) return 'وارد Jira نشده‌اید یا نشست شما منقضی شده است. ابتدا وارد Jira شوید و دوباره بوکمارک را اجرا کنید.';
    if (err instanceof JiraError && err.status === 403) return 'Jira اجازه‌ی دسترسی نداد (۴۰۳).';
    return err.message;
  }

  async function openProject(key) {
    if (!isValidProjectKey(key)) return paint(renderHome({ projects, user, error: 'کلید پروژه معتبر نیست' }));
    const mine = ++seq;
    current = key;
    storage.setItem(lastKey, key);
    paint(renderLoading(`در حال دریافت اطلاعات پروژه‌ی ${key} از Jira…`));
    try {
      const open = await jqlSearchAll(session, `project = ${key} AND issuetype = Story AND statusCategory != Done`, ['summary']);
      if (mine !== seq) return;
      paint(renderProject({ projects, user, key, openStories: open.length, config: projectConfig(key) }));
    } catch (err) {
      if (mine !== seq) return;
      console.error('[jira-roadmap]', err);
      current = null;
      paint(renderHome({ projects, user, error: describe(err) }));
    }
  }

  async function start() {
    paint(renderLoading('در حال اتصال به Jira…'));
    try {
      const me = await getMyself(session);
      user = me.displayName || me.name || '';
      projects = await listProjects(session);
    } catch (err) {
      console.error('[jira-roadmap]', err);
      return paint(renderHome({ projects: [], user, error: describe(err), fatal: true }));
    }
    const remembered = storage.getItem(lastKey);
    if (remembered && projects.some((p) => p.key === remembered)) return openProject(remembered);
    paint(renderHome({ projects, user }));
  }

  return { start, openProject };
}
