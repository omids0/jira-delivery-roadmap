import { fetchProject } from '../collect.js';
import { JiraError, getMyself, isValidProjectKey, listProjects } from '../jiraClient.js';
import { buildModel, summarize } from '../model.js';
import { renderHome, renderProject, renderLoading } from '../render/shell.js';
import { loadSettings, normalizeSettings, saveSettings, settingsKey } from '../settings.js';

const LAST_PROJECT_KEY = 'jira-roadmap:last-project:';
const CACHE_MS = 60_000;

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
  const host = new URL(baseUrl).host;
  const lastKey = LAST_PROJECT_KEY + host;
  let raw = null; // raw Jira issues of the current project; the model is rebuilt from it when settings change
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
      const hit = e.target?.closest?.('#jr-refresh, #jr-close, #jr-confirm');
      if (hit?.id === 'jr-refresh') openProject(current, { refresh: true });
      else if (hit?.id === 'jr-close') onClose();
      else if (hit?.id === 'jr-confirm') confirmSettings();
    });
  };

  const settingsOf = (key) => loadSettings(storage, settingsKey(host, key), projectConfig(key));

  const showProject = (saved = false) => {
    const settings = settingsOf(current);
    const summary = summarize(buildModel(raw, { ...projectConfig(current), ...settings }));
    paint(renderProject({ projects, user, key: current, summary, settings, saved }));
  };

  function confirmSettings() {
    const doc = frame.document;
    if (!doc || !current) return;
    const val = (id) => doc.getElementById(id)?.value;
    const next = normalizeSettings({
      team: { be: val('jr-be'), fe: val('jr-fe') },
      parallelStories: val('jr-par'),
      components: { be: val('jr-cbe'), fe: val('jr-cfe') }
    }, projectConfig(current));
    saveSettings(storage, settingsKey(host, current), next);
    showProject(true);
  }

  function describe(err) {
    if (err instanceof JiraError && err.status === 404) return 'این صفحه متعلق به Jira نیست. بوکمارک را وقتی اجرا کنید که در خود Jira هستید.';
    if (err instanceof JiraError && err.status === 401) return 'وارد Jira نشده‌اید یا نشست شما منقضی شده است. ابتدا وارد Jira شوید و دوباره بوکمارک را اجرا کنید.';
    if (err instanceof JiraError && err.status === 403) return 'Jira اجازه‌ی دسترسی نداد (۴۰۳).';
    return err.message;
  }

  async function openProject(key, { refresh = false } = {}) {
    if (!isValidProjectKey(key)) return paint(renderHome({ projects, user, error: 'کلید پروژه معتبر نیست' }));
    const mine = ++seq;
    current = key;
    storage.setItem(lastKey, key);
    try {
      const cached = session.cache[key];
      if (!refresh && cached && Date.now() - cached.at < CACHE_MS) raw = cached.raw;
      else {
        paint(renderLoading(`در حال دریافت اطلاعات پروژه‌ی ${key} از Jira…`));
        const fetched = await fetchProject(session, key, { ...projectConfig(key), ...settingsOf(key) }, (t) => mine === seq && paint(renderLoading(t)));
        session.cache[key] = { at: Date.now(), raw: fetched };
        raw = fetched;
      }
      if (mine !== seq) return;
      showProject();
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
