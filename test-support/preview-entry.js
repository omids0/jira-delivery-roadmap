// Dev preview: the full roadmap on a larger synthetic project, no Jira needed.
// Built by scripts/preview.js. Not shipped.
import { buildContext } from '../src/adapter.js';
import { createEngine } from '../src/engine.js';
import { buildModel, summarize } from '../src/model.js';
import { qualityNotes } from '../src/quality.js';
import { createEnv } from '../src/render/env.js';
import { addFont, renderPage } from '../src/render/page.js';
import { defaultState } from '../src/roadmapState.js';
import { mountRoadmap } from '../src/browser/roadmap-ui.js';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const st = (c) => ({ name: c, statusCategory: { key: c, name: c === 'done' ? 'Done' : c === 'new' ? 'To Do' : 'In Progress' } });
const day = (d) => new Date(Date.UTC(2026, 9, 20 - d, 9)).toISOString().replace('Z', '+0000');
const people = { be: ['Bahar', 'Behnam'], fe: ['Farid'] };

const epics = [100, 200, 300, 400].map((n, i) => ({ key: `PRJ-${n}`, fields: { summary: ['Checkout', 'Catalog', 'Accounts', 'Reporting'][i], status: st('new') } }));
const stories = [];
const subtasks = [];
for (let i = 1; i <= 34; i++) {
  const key = `PRJ-${i}`;
  const done = i <= 8;
  const links = i > 3 && rnd() < 0.6 ? [{ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: `PRJ-${int(1, i - 1)}`, fields: { status: st('new') } } }] : [];
  stories.push({ key, fields: { summary: `Story ${i}: ${['list view', 'edit form', 'export', 'permissions', 'search'][i % 5]}`, status: st(done ? 'done' : i % 9 === 0 ? 'indeterminate' : 'new'), labels: i % 11 === 0 ? ['needs-decision'] : [], components: [], issuelinks: links, customfield_1: epics[i % 4].key, assignee: null, resolutiondate: done ? day(30 - i) : null } });
  for (const role of ['be', 'fe']) {
    for (let j = 0; j < (role === 'be' ? int(3, 9) : int(0, 7)); j++) {
      const sdone = done || (j % 3 === 0 && i < 14);
      subtasks.push({ key: `PRJ-${i}-${role}${j}`, fields: { summary: 'task', status: st(sdone ? 'done' : 'new'), components: [{ name: role === 'be' ? 'Back-End' : 'Front-End' }], labels: [], parent: { key }, assignee: { displayName: people[role][j % people[role].length] }, resolutiondate: sdone ? day(int(0, 55)) : null } });
    }
  }
}
const raw = {
  epics, stories, subtasks, epicField: 'customfield_1',
  assigned: subtasks.filter((t) => t.fields.status.statusCategory.key !== 'done').slice(0, 14).map((t) => ({ key: t.key, fields: { summary: 'open work item', status: st('new'), issuetype: { name: 'Sub-task' }, assignee: t.fields.assignee, parent: t.fields.parent, priority: { name: 'Medium' }, updated: day(2) } })),
  sprints: [
    { id: 1, name: 'Sprint 6', state: 'closed', startDate: day(56), endDate: day(42), completeDate: day(42) },
    { id: 2, name: 'Sprint 7', state: 'closed', startDate: day(42), endDate: day(28), completeDate: day(28) },
    { id: 3, name: 'Sprint 8', state: 'closed', startDate: day(28), endDate: day(14), completeDate: day(14) },
    { id: 4, name: 'Sprint 9', state: 'active', startDate: day(14), endDate: day(-1) }
  ]
};
const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: {}, weekend: [4, 5], locale: 'fa-IR-u-ca-persian', team: { be: 2, fe: 1 }, parallelStories: 3 };
const model = buildModel(raw, cfg);
const ctx = buildContext({ raw, model, sprints: raw.sprints, assigned: raw.assigned, cfg, baseUrl: 'https://jira.example', project: 'PRJ', now: new Date(2026, 9, 20, 12) });
const eng = createEngine(ctx);
const state = defaultState(cfg);
const settings = { team: cfg.team, parallelStories: 3, components: cfg.components };
const R = createEnv(ctx, eng, state);
document.open();
document.write(renderPage(R, { projects: [{ key: 'PRJ', name: 'Preview project' }], user: 'Preview', key: 'PRJ', projectName: 'Preview project', settings, notes: qualityNotes(summarize(model)) }));
document.close();
addFont(document);
window.__view = mountRoadmap({ doc: document, ctx, eng, state, persist() {}, onRefresh() {} });
