import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWorklogIssues } from '../src/collect.js';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderWorklogPanel } from '../src/render/worklogPanel.js';
import { normSprint, normalizeState, defaultState } from '../src/roadmapState.js';
import { summarizeWorklogs, worklogWindow } from '../src/worklog.js';
import { baseState, fixture } from '../test-support/fixture.js';

const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: {} };
const win = { since: '2026-10-01', until: '2026-10-31' };
const done = (key, role, hours, resolved = '2026-10-10T10:00:00.000+0000') => ({ key, fields: { summary: 'x', status: { statusCategory: { key: 'done' } }, components: [{ name: role === 'be' ? 'Back-End' : 'Front-End' }], labels: [], timespent: hours * 3600, resolutiondate: resolved } });
const log = (who, day, hours) => ({ author: { displayName: who }, started: `${day}T09:00:00.000+0000`, timeSpentSeconds: hours * 3600 });
const weekdays = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-11', '2026-10-12']; // Sun-Wed: workdays for weekend [4, 5]
const roleOfName = (n) => (n === 'Fay' ? 'fe' : 'be');

const subtasks = [
  ...[2, 4, 3, 5, 6].map((h, i) => done('b' + i, 'be', h)), // back-end: mean 4h
  ...[1, 1, 2, 2, 4].map((h, i) => done('f' + i, 'fe', h)), // front-end: mean 2h
  done('old', 'be', 99, '2026-08-01T10:00:00.000+0000'), // outside the window
  { ...done('open', 'be', 5), fields: { ...done('open', 'be', 5).fields, status: { statusCategory: { key: 'new' } } } } // not done
];
const worklogIssues = [{ key: 'x', fields: { worklog: { total: 99, worklogs: [
  ...weekdays.map((d) => log('Ann', d, 6)), // 6h a day
  ...weekdays.slice(0, 4).map((d) => log('Fay', d, 4)), // 4h a day
  log('Ann', '2026-10-08', 8), // a Thursday: weekend, ignored
  log('Zed', '2026-10-04', 8), log('Zed', '2026-10-05', 8) // two days only: not enough to count
] } } }];

test('window: the last closed sprints, else 60 days', () => {
  const sp = (n, a, b) => ({ name: n, state: 'closed', startDate: a, endDate: b, completeDate: b });
  const w = worklogWindow([sp('S1', '2026-08-01', '2026-08-15'), sp('S2', '2026-08-16', '2026-08-30'), { name: 'S3', state: 'active', startDate: '2026-09-01', endDate: '2026-09-15' }], new Date('2026-09-10'));
  assert.deepEqual(w, { since: '2026-08-01', until: '2026-08-30' });
  assert.deepEqual(worklogWindow([], new Date('2026-10-31T12:00:00Z')), { since: '2026-09-01', until: '2026-10-31' });
});

test('hours per sub-task and per day, and the pace they give', () => {
  const W = summarizeWorklogs({ subtasks, worklogIssues, window: win, weekend: [4, 5], cfg, roleOfName });
  assert.equal(W.perSubtask.be.n, 5); // the old and the open one are left out
  assert.equal(W.perSubtask.be.avg, 4);
  assert.equal(W.perSubtask.be.median, 4);
  assert.equal(W.perSubtask.fe.avg, 2);
  assert.deepEqual(Object.keys(W.people).sort(), ['Ann', 'Fay']); // Zed logged too few days
  assert.equal(W.people.Ann.days, 6); // the weekend log is not a day
  assert.equal(W.people.Ann.perDay, 6);
  assert.equal(W.perDay.fe, 4);
  assert.equal(W.pace.BE, 6 / 4); // 6 h a day, 4 h a sub-task
  assert.equal(W.pace.FE, 4 / 2);
  assert.equal(W.people.Ann.pace, 1.5);
  assert.equal(W.partial, false);
});

test('not enough data: no pace; one role enough: partial', () => {
  const none = summarizeWorklogs({ subtasks: subtasks.slice(0, 2), worklogIssues, window: win, weekend: [4, 5], cfg, roleOfName });
  assert.equal(none.pace, null);
  const fewFe = summarizeWorklogs({ subtasks: subtasks.filter((t) => !t.key.startsWith('f')), worklogIssues, window: win, weekend: [4, 5], cfg, roleOfName });
  assert.equal(fewFe.partial, true);
  assert.equal(fewFe.pace.FE, null);
  assert.equal(summarizeWorklogs({ subtasks: [], worklogIssues: [], window: win, weekend: [4, 5], cfg, roleOfName }).pace, null);
});

const withLogs = () => {
  const W = summarizeWorklogs({ subtasks, worklogIssues, window: win, weekend: [4, 5], cfg, roleOfName });
  const ctx = { ...fixture(), WORKLOG: W, people: [{ role: 'BE', n: 1, name: 'Ann', jira: ['Ann'] }, { role: 'FE', n: 1, name: 'Fay', jira: ['Fay'] }] };
  const eng = createEngine(ctx);
  return { ctx, eng, W, state: { ...baseState, devs: { BE: [], FE: [] } }, R: (s) => createEnv(ctx, eng, s) };
};

test('engine: a worklog pace appears; a named person uses their own logged pace unless a manual pace is set', () => {
  const { eng, state } = withLogs();
  assert.equal(eng.PACE.wl.BE, 1.5);
  assert.equal(eng.PACE.wl.n, 'میانگین ورک‌لاگ‌های ثبت‌شده');
  assert.deepEqual(eng.devPaces({ ...state, pace: 'wl' }).BE, [1.5]);
  assert.deepEqual(eng.devPaces({ ...state, pace: 'wl', devs: { BE: [{ name: 'Ann', pace: 9 }], FE: [] } }).BE, [9]);
  assert.notEqual(eng.devPaces({ ...state, pace: 'avg' }).BE[0], 1.5);
});

test('engine: the sprint proposal uses logged time by default, sprint velocity on request', () => {
  const { eng, state } = withLogs();
  assert.equal(eng.sprintPaceKey(state), 'wl');
  assert.equal(eng.planForSprint(state).paceKey, 'wl');
  assert.equal(eng.planForSprint({ ...state, sprint: normSprint({ basis: 'velocity' }) }).paceKey, 'avg');
  assert.equal(eng.planForSprint({ ...state, pace: 'wl', sprint: normSprint({ basis: 'velocity' }) }).paceKey, 'avg');
  const noLogs = createEngine({ ...fixture(), WORKLOG: null });
  assert.equal(noLogs.sprintPaceKey(state), 'avg');
  assert.equal(noLogs.PACE.wl, undefined);
});

test('state: wl is a valid scenario and basis is kept only when known', () => {
  assert.equal(normalizeState({ pace: 'wl' }, defaultState({})).pace, 'wl');
  assert.equal(normSprint({ basis: 'wl' }).basis, 'wl');
  assert.equal(normSprint({ basis: 'bogus' }).basis, null);
});

test('panel: shows hours per sub-task, hours per day, both paces and the people; explains when there is no data', () => {
  const { R, state } = withLogs();
  const html = renderWorklogPanel(R(state));
  assert.ok(html.includes('Ann') && html.includes('Fay') && html.includes('ساعت در روز'));
  assert.ok(html.includes('<b>1.5</b>') || html.includes('<b>۱٫۵</b>'));
  assert.ok(!/undefined|NaN/.test(html));
  const noneCtx = { ...fixture(), WORKLOG: null };
  assert.ok(renderWorklogPanel(createEnv(noneCtx, createEngine(noneCtx), baseState)).includes('ورک‌لاگی از Jira خوانده نشد'));
  const few = { ...fixture(), WORKLOG: summarizeWorklogs({ subtasks: [], worklogIssues: [], window: win, weekend: [4, 5], cfg, roleOfName }) };
  assert.ok(renderWorklogPanel(createEnv(few, createEngine(few), baseState)).includes('ورک‌لاگ کافی پیدا نشد'));
});

test('fetch: reads the rest of the worklogs of an issue that has more than the search embeds; null when Jira refuses', async () => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes('/rest/api/2/search')
      ? { total: 1, issues: [{ key: 'P-1', fields: { worklog: { total: 3, maxResults: 1, worklogs: [log('Ann', '2026-10-04', 1)] } } }] }
      : { worklogs: [log('Ann', '2026-10-04', 1), log('Ann', '2026-10-05', 1), log('Ann', '2026-10-06', 1)] };
    return { ok: true, json: async () => body, text: async () => '' };
  };
  try {
    const issues = await fetchWorklogIssues({ baseUrl: 'https://jira.example', meta: {} }, 'P', '2026-10-01');
    assert.equal(issues[0].fields.worklog.worklogs.length, 3);
    assert.ok(calls.some((u) => u.includes('/issue/P-1/worklog')));
    assert.ok(calls[0].includes('worklogDate') && calls[0].includes('2026-10-01'));
    globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => '' });
    assert.equal(await fetchWorklogIssues({ baseUrl: 'https://jira.example', meta: {} }, 'P', '2026-10-01'), null);
  } finally {
    globalThis.fetch = real;
  }
});
