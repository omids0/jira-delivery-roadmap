import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, roleOf, summarize } from '../src/model.js';

const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: { fe: ['ui-work'], be: [] } };
const status = (category) => ({ name: category, statusCategory: { key: category } });
const story = (key, extra = {}) => ({ key, fields: { summary: `story ${key}`, status: status('new'), labels: [], components: [], issuelinks: [], customfield_1: null, ...extra } });
const sub = (key, parent, extra = {}) => ({ key, fields: { summary: 'task', status: status('new'), components: [], labels: [], parent: { key: parent }, ...extra } });
const raw = (over) => ({ epics: [], stories: [], subtasks: [], epicField: 'customfield_1', ...over });

test('role: component beats label beats title guess', () => {
  assert.equal(roleOf({ components: [{ name: 'Front-End' }], summary: 'api' }, cfg), 'fe');
  assert.equal(roleOf({ components: [{ name: 'back-end service' }], summary: 'صفحه' }, cfg), 'be');
  assert.equal(roleOf({ labels: ['UI-Work'], summary: 'x' }, cfg), 'fe');
  assert.equal(roleOf({ summary: 'ساخت صفحه ورود' }, cfg), 'fe');
  assert.equal(roleOf({ summary: 'create endpoint' }, cfg), 'be');
});

test('sub-tasks are counted per story and role, open vs total', () => {
  const m = buildModel(raw({
    stories: [story('P-1')],
    subtasks: [
      sub('P-2', 'P-1', { components: [{ name: 'Back-End' }] }),
      sub('P-3', 'P-1', { components: [{ name: 'Back-End' }], status: status('done') }),
      sub('P-4', 'P-1', { components: [{ name: 'Front-End' }] }),
      sub('P-5', 'P-9')
    ]
  }), cfg);
  assert.deepEqual(m.stories[0].subtasks, { be: { open: 1, total: 2 }, fe: { open: 1, total: 1 } });
});

test('both ends of a "blocks" link produce the same dependency', () => {
  const fromBlocked = story('P-2', { issuelinks: [{ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'P-1', fields: { status: status('new') } } }] });
  const fromBlocker = story('P-1', { issuelinks: [{ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'P-2', fields: { status: status('new') } } }] });
  for (const stories of [[fromBlocked, story('P-1')], [story('P-2'), fromBlocker]]) {
    const m = buildModel(raw({ stories }), cfg);
    assert.deepEqual(m.stories.find((s) => s.key === 'P-2').blockedBy, ['P-1']);
    assert.deepEqual(m.stories.find((s) => s.key === 'P-1').blockedBy, []);
  }
});

test('non-blocking link types are ignored; blockers outside the project are external', () => {
  const m = buildModel(raw({
    stories: [story('P-2', { issuelinks: [
      { type: { name: 'Relates', inward: 'relates to', outward: 'relates to' }, inwardIssue: { key: 'P-1', fields: {} } },
      { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'OTHER-7', fields: { status: status('indeterminate') } } }
    ] }), story('P-1')]
  }), cfg);
  const s = m.stories.find((x) => x.key === 'P-2');
  assert.deepEqual(s.blockedBy, []);
  assert.deepEqual(s.externalBlockers, [{ key: 'OTHER-7', done: false }]);
});

test('epic comes from the epic link field; missing field means no epic', () => {
  const m = buildModel(raw({ stories: [story('P-1', { customfield_1: 'P-100' })], epics: [{ key: 'P-100', fields: { summary: 'Checkout', status: status('new') } }] }), cfg);
  assert.equal(m.stories[0].epic, 'P-100');
  assert.equal(buildModel(raw({ stories: [story('P-1', { customfield_1: 'P-100' })], epicField: null }), cfg).stories[0].epic, null);
});

test('summary: counts, per-epic rows and data-quality numbers', () => {
  const m = buildModel(raw({
    epics: [{ key: 'P-100', fields: { summary: 'Checkout', status: status('new') } }, { key: 'P-9', fields: { summary: 'Empty', status: status('new') } }],
    stories: [
      story('P-1', { customfield_1: 'P-100' }),
      story('P-2', { customfield_1: 'P-100', status: status('done') }),
      story('P-3', { issuelinks: [{ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'P-1', fields: {} } }] })
    ],
    subtasks: [sub('P-4', 'P-1', { components: [{ name: 'Back-End' }] })]
  }), cfg);
  const s = summarize(m);
  assert.equal(s.open, 2);
  assert.equal(s.done, 1);
  assert.equal(s.noEpic, 1);
  assert.equal(s.noSubtasks, 1);
  assert.equal(s.withBlockers, 1);
  assert.deepEqual(s.epics.map((r) => [r.key, r.openStories, r.doneStories]), [['P-100', 1, 1], [null, 1, 0]]);
});
