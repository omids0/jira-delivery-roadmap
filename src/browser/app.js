import { buildContext } from '../adapter.js';
import { fetchProject } from '../collect.js';
import { createEngine } from '../engine.js';
import { createEnv } from '../render/env.js';
import { JiraError, getMyself, isValidProjectKey, listProjects } from '../jiraClient.js';
import { buildModel, summarize } from '../model.js';
import { qualityNotes } from '../quality.js';
import { renderHome, renderLoading, renderPage } from '../render/page.js';
import { loadState, saveState, stateKey } from '../roadmapState.js';
import { loadSettings, normalizeSettings, saveSettings, settingsKey } from '../settings.js';
import { mountRoadmap } from './roadmap-ui.js';

const LAST_PROJECT_KEY = 'jira-roadmap:last-project:';
const CACHE_MS = 60_000;

/**
 * The roadmap running INSIDE a Jira page (via the bookmarklet). Same origin as
 * Jira, so requests carry the user's logged-in session: no token, no CORS.
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
  let raw = null; // raw Jira issues of the current project; model and plan are rebuilt from it
  let projects = [];
  let user = '';
  let current = null;
  let view = null;
  let seq = 0; // drops answers from a project the user already switched away from

  const paint = (html) => {
    const doc = frame.document;
    // The overlay is gone once the user closed it; late answers have nowhere to go.
    if (!doc) return null;
    view = null;
    doc.open();
    doc.write(html);
    doc.close();
    // document.open() drops every listener: bind on the document (events bubble to it).
    doc.addEventListener('change', (e) => {
      if (e.target?.id === 'jr-project') openProject(e.target.value);
    });
    doc.addEventListener('click', (e) => {
      const hit = e.target?.closest?.('#jr-close, #jr-confirm');
      if (hit?.id === 'jr-close') onClose();
      else if (hit?.id === 'jr-confirm') confirmSettings();
    });
    return doc;
  };

  const settingsOf = (key) => loadSettings(storage, settingsKey(host, key), projectConfig(key));
  const configOf = (key) => ({ ...projectConfig(key), ...settingsOf(key) });

  function showProject(saved = false) {
    const cfg = configOf(current);
    const model = buildModel(raw, cfg);
    const ctx = buildContext({ raw, model, sprints: raw.sprints, assigned: raw.assigned, cfg, baseUrl, project: current, now: new Date() });
    const eng = createEngine(ctx);
    const sKey = stateKey(host, current);
    const state = loadState(storage, sKey, cfg);
    const name = projects.find((p) => p.key === current)?.name;

    // an engine/plan failure must not leave a blank overlay
    try {
      const page = renderPage(createEnv(ctx, eng, state), {
        projects, user, key: current, projectName: name, settings: settingsOf(current), saved, notes: qualityNotes(summarize(model))
      });
      const doc = paint(page);
      if (!doc) return;
      view = mountRoadmap({ doc, ctx, eng, state, persist: () => saveState(storage, sKey, state), onRefresh: () => openProject(current, { refresh: true }) });
    } catch (err) {
      console.error('[jira-roadmap]', err);
      paint(renderHome({ projects, user, error: `ساخت نقشه‌ی راه ناموفق بود: ${err.message}` }));
    }
  }

  function confirmSettings() {
    const doc = frame.document;
    if (!doc || !current) return;
    const val = (id) => doc.getElementById(id)?.value;
    const base = projectConfig(current);
    const next = normalizeSettings({ ...settingsOf(current), components: { be: val('jr-cbe'), fe: val('jr-cfe') } }, base);
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
        const fetched = await fetchProject(session, key, configOf(key), (t) => mine === seq && paint(renderLoading(t)));
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

  return { start, openProject, get view() { return view; } };
}
