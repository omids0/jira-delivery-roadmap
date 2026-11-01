import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModules, trueState } from '../src/modules.js';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderModules } from '../src/render/modules.js';
import { baseState, fixture } from '../test-support/fixture.js';

const subs = (beOpen, beTotal, feOpen, feTotal) => ({ be: { open: beOpen, total: beTotal }, fe: { open: feOpen, total: feTotal } });
const story = (key, title, category, extra = {}) => ({ key, title, category, done: category === 'done', epic: null, labels: [], subtasks: subs(0, 0, 0, 0), ...extra });

test('true state: Done is Done, new is Backlog; in progress becomes Done only when every back-end and front-end sub-task is Done', () => {
  assert.equal(trueState(story('A-1', 'x', 'done')), 'done');
  assert.equal(trueState(story('A-1', 'x', 'new')), 'backlog');
  assert.equal(trueState(story('A-1', 'x', 'indeterminate')), 'inprogress'); // no sub-tasks yet
  assert.equal(trueState(story('A-1', 'x', 'indeterminate', { subtasks: subs(0, 3, 0, 2) })), 'done');
  assert.equal(trueState(story('A-1', 'x', 'indeterminate', { subtasks: subs(0, 3, 0, 0) })), 'inprogress'); // back-end done, front-end not started
  assert.equal(trueState(story('A-1', 'x', 'indeterminate', { subtasks: subs(1, 3, 0, 2) })), 'inprogress');
});

const model = (stories, epics = []) => ({ stories, epics });

test('prefix mode: US-XXX-nn titles group by XXX, sorted by size, counts add up', () => {
  const m = buildModules(model([
    story('A-1', 'US-PROD-01: a', 'done'), story('A-2', 'US-PROD-02: b', 'new'), story('A-3', 'US-PROD-03: c', 'indeterminate'),
    story('A-4', 'US-SEL-01: d', 'new'), story('A-5', 'no prefix', 'new')
  ]), { moduleLabels: { PROD: 'Products' } });
  assert.equal(m.mode, 'prefix');
  assert.deepEqual(m.modules.map((x) => [x.id, x.label, x.total]), [['PROD', 'Products', 3], ['SEL', 'SEL', 1], ['سایر', 'سایر', 1]]);
  assert.deepEqual(m.modules[0], { id: 'PROD', label: 'Products', done: 1, inProgress: 1, backlog: 1, total: 3 });
  assert.deepEqual(m.totals, { done: 1, inProgress: 1, backlog: 3, total: 5 });
});

test('auto falls back to epics when titles have no prefix, and to one group when there are no epics', () => {
  const stories = [story('A-1', 'plain', 'done', { epic: 'A-100' }), story('A-2', 'plain', 'new', { epic: 'A-100' }), story('A-3', 'plain', 'new')];
  const e = buildModules(model(stories, [{ key: 'A-100', name: 'Checkout' }]), {});
  assert.equal(e.mode, 'epic');
  assert.deepEqual(e.modules.map((x) => [x.id, x.label, x.total]), [['A-100', 'Checkout', 2], ['NO_EPIC', 'بدون اپیک', 1]]);
  const n = buildModules(model([story('A-1', 'plain', 'new')]), {});
  assert.equal(n.mode, 'none');
  assert.equal(n.modules[0].label, 'همه');
});

test('cancelled stories are left out; a broken pattern does not crash', () => {
  const m = buildModules(model([story('A-1', 'US-X-01', 'new', { labels: ['cancelled'] }), story('A-2', 'US-X-02', 'new')]), { modulePattern: '(' });
  assert.equal(m.totals.total, 1);
});

test('bars and table: percentages, totals row, escaped names', () => {
  const ctx = { ...fixture(), MODULES: buildModules(model([
    story('A-1', 'US-<b>-01', 'done'), story('A-2', 'US-PROD-01', 'done'), story('A-3', 'US-PROD-02', 'new'), story('A-4', 'US-PROD-03', 'indeterminate')
  ]), { moduleLabels: { PROD: '<i>Products</i>' } }) };
  const R = createEnv(ctx, createEngine(ctx), baseState);
  const out = renderModules(R);
  assert.ok(out.bars.includes('&lt;i&gt;Products&lt;/i&gt;') && !out.bars.includes('<i>Products</i>'));
  assert.match(out.bars, /<b>33%<\/b> \/ 33% \/ 33%/);
  assert.ok(out.table.includes('class="sum"') && out.table.includes('<td>جمع</td><td class="n">2</td><td class="n">1</td><td class="n">1</td><td class="n">4</td><td class="n">50%</td>'));
  assert.ok(out.note.includes('پیشوند عنوان'));
  assert.ok(!/undefined|NaN/.test(out.bars + out.table));
  assert.equal(renderModules(createEnv({ ...ctx, MODULES: null }, createEngine(ctx), baseState)).table, '');
});
