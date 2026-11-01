import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSprint } from '../src/currentSprint.js';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderCurrentSprint } from '../src/render/sprintNow.js';
import { baseState, fixture } from '../test-support/fixture.js';

const st = (c, name = c) => ({ name, statusCategory: { key: c } });
const issue = (key, type, category, extra = {}) => ({ key, fields: { summary: `${type} ${key}`, status: st(category), issuetype: { name: type, subtask: type === 'Sub-task' }, components: [], labels: [], assignee: null, customfield_1: null, ...extra } });
const sub = (key, parent, category, role) => issue(key, 'Sub-task', category, { parent: { key: parent }, components: [{ name: role === 'be' ? 'Back-End' : 'Front-End' }] });

const sprint = { name: 'Sprint 4', startDate: '2026-10-11T08:00:00.000Z', endDate: '2026-10-25T08:00:00.000Z' };
const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: {} };
const issues = [
  issue('P-1', 'Story', 'done', { customfield_1: 'P-100' }),
  issue('P-2', 'Story', 'done', { customfield_1: 'P-100' }),
  issue('P-3', 'Story', 'indeterminate', { customfield_1: 'P-100', assignee: { displayName: 'Ann' } }),
  issue('P-4', 'Story', 'new'),
  sub('P-5', 'P-3', 'done', 'be'), sub('P-6', 'P-3', 'done', 'be'), sub('P-7', 'P-3', 'done', 'fe'), sub('P-8', 'P-3', 'new', 'fe'),
  issue('P-9', 'Bug', 'done'),
  issue('P-100', 'Epic', 'new')
];
const run = (over = {}) => summarizeSprint(sprint, issues, { cfg, today: new Date(2026, 9, 20, 12), weekend: [4, 5], epicField: 'customfield_1', epicName: (k) => (k === 'P-100' ? 'Checkout' : null), ...over });

test('counts stories by state, sub-tasks by role, and other items; epics are not counted', () => {
  const s = run();
  assert.deepEqual(s.stories, { total: 4, done: 2, doing: 1, todo: 1 });
  assert.deepEqual([s.subs.total, s.subs.done], [4, 3]);
  assert.deepEqual([s.subs.be.done, s.subs.be.total, s.subs.fe.done, s.subs.fe.total], [2, 2, 1, 2]);
  assert.deepEqual([s.other.total, s.other.done], [1, 1]);
});

test('working days: total, elapsed (today included) and left', () => {
  assert.deepEqual(run().days, { total: 11, elapsed: 8, left: 3 });
  assert.equal(run({ today: new Date(2026, 9, 30) }).days.left, 0); // after the end: nothing left, never negative
});

test('pace compares finished sub-tasks with the time that has passed', () => {
  assert.equal(run().pace, 'on'); // 75% done vs 73% of the time
  assert.equal(run({ today: new Date(2026, 9, 12) }).pace, 'ahead');
  assert.equal(run({ today: new Date(2026, 9, 25) }).pace, 'behind'); // last day: 75% done against 100% of the time
  assert.equal(summarizeSprint(sprint, [], { cfg, today: new Date(2026, 9, 20), weekend: [4, 5], epicField: null, epicName: () => null }).pace, null);
});

test('epics group the stories (no-epic last), unfinished first, with sub-task progress', () => {
  const s = run();
  assert.deepEqual(s.epics.map((g) => [g.key, g.name, g.items.length, g.done]), [['P-100', 'Checkout', 3, 2], [null, null, 1, 0]]);
  assert.deepEqual(s.epics[0].items.map((x) => x.k), ['P-3', 'P-1', 'P-2']);
  assert.deepEqual(s.epics[0].items[0].subs, { done: 3, total: 4 });
});

test('card: shows the numbers, escapes Jira text, and is empty without a running sprint', () => {
  const ctx = { ...fixture(), CURRENT_SPRINT: run({ epicName: () => '<b>Epic</b>' }) };
  const R = createEnv(ctx, createEngine(ctx), baseState);
  const html = renderCurrentSprint(R);
  assert.ok(html.includes('اسپرینت جاری') && html.includes('Sprint 4'));
  assert.ok(html.includes('&lt;b&gt;Epic&lt;/b&gt;') && !html.includes('<b>Epic</b>'));
  assert.ok(!/undefined|NaN/.test(html));
  const none = createEnv({ ...ctx, CURRENT_SPRINT: null }, createEngine(ctx), baseState);
  assert.equal(renderCurrentSprint(none), '');
});
