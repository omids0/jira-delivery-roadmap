import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { feCandidates, renderFeReady } from '../src/render/feReady.js';
import { baseState, fixture } from '../test-support/fixture.js';

// mod: module id of the story (modules map is built from it)
const story = (k, beOpen, beTotal, feOpen, feTotal, extra = {}) => ({
  k, ep: 'e1', title: `Story ${k}`, be: 5, fe: 4, deps: [], f: [], known: { ...(beTotal ? { be: beOpen } : {}), ...(feTotal ? { fe: feOpen } : {}) },
  done: false, res: null, hist: false, subs: { be: { open: beOpen, total: beTotal }, fe: { open: feOpen, total: feTotal } }, ...extra
});

const setup = (stories, mods = {}, sprintKeys = null) => {
  const base = fixture();
  const of = Object.fromEntries(stories.map((s) => [s.k, { id: mods[s.k] || 'M1', label: `Mod ${mods[s.k] || 'M1'}` }]));
  const ctx = { ...base, stories, MODULES: { mode: 'prefix', modules: [], totals: {}, of } };
  if (sprintKeys) ctx.CURRENT_SPRINT = { name: 'Sprint X', epics: [{ items: sprintKeys.map((k) => ({ k })) }] };
  const eng = createEngine(ctx);
  const R = createEnv(ctx, eng, { ...baseState, devs: { BE: [], FE: [] } });
  return { R, P: eng.plan(R.state) };
};
const keys = (l) => l.map((x) => x.s.k);

test('back-end all Done and NO front-end sub-task yet is ready (the case where Jira has nothing for the front-end to open)', () => {
  const { R, P } = setup([
    story('PR-1', 0, 3, 0, 0, { be: 3, fe: 0 }), // no FE label, no FE sub-tasks: still ready
    story('PR-2', 1, 4, 0, 0), // three quarters: contract list
    story('PR-6', 2, 4, 0, 0), // exactly half: not more than half
    story('PR-3', 3, 4, 0, 0), // a quarter
    story('PR-5', 0, 0, 0, 0), // back-end never decomposed: nothing proven
    story('PR-4', 0, 3, 0, 2) // front-end sub-tasks all Done, story still open: stale, not work
  ]);
  const c = feCandidates(R, P);
  assert.deepEqual(keys(c.ready), ['PR-1']);
  assert.deepEqual(keys(c.contract), ['PR-2']);
  assert.deepEqual(keys(c.active), []);
});

test('front-end sub-tasks already open: story is in progress, not ready', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 2, 2), story('PR-2', 3, 3, 1, 2)]);
  const c = feCandidates(R, P);
  assert.deepEqual(keys(c.ready), []);
  assert.deepEqual(keys(c.active), ['PR-1', 'PR-2']);
});

test('one ready story per module, the rest queue; a module with front-end in flight holds its ready stories', () => {
  const { R, P } = setup(
    [story('PR-1', 0, 2, 0, 0), story('PR-2', 0, 2, 0, 0), story('PR-3', 0, 2, 0, 0), story('PR-4', 0, 2, 0, 0), story('PR-5', 0, 2, 1, 2)],
    { 'PR-1': 'A', 'PR-2': 'A', 'PR-3': 'B', 'PR-4': 'C', 'PR-5': 'C' }
  );
  const c = feCandidates(R, P);
  assert.deepEqual(keys(c.now), ['PR-1', 'PR-3']);
  assert.deepEqual(keys(c.queued), ['PR-2']);
  assert.deepEqual(keys(c.held), ['PR-4']);
  assert.deepEqual(c.busyModules, ['Mod C']);
});

test('with a running sprint only its stories are suggested; the others are only mentioned', () => {
  const { R, P } = setup([story('PR-1', 0, 2, 0, 0), story('PR-2', 0, 2, 0, 0)], { 'PR-1': 'A', 'PR-2': 'B' }, ['PR-1']);
  const c = feCandidates(R, P);
  assert.deepEqual(keys(c.now), ['PR-1']);
  assert.deepEqual(keys(c.outside), ['PR-2']);
  const html = renderFeReady(R, P);
  assert.ok(html.includes('Sprint X') && html.includes('خارج از این اسپرینت'));
});

test('a story that waits on an open story is marked and sorted after the free ones', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 0, 0, { deps: ['PR-9'] }), story('PR-2', 0, 3, 0, 0), story('PR-9', 5, 5, 5, 5)], { 'PR-1': 'A', 'PR-2': 'B', 'PR-9': 'C' });
  const { ready } = feCandidates(R, P);
  assert.deepEqual(keys(ready), ['PR-2', 'PR-1']);
  assert.deepEqual(ready[1].waits, ['PR-9']);
});

test('without modules every ready story is offered at once', () => {
  const { R, P } = setup([story('PR-1', 0, 2, 0, 0), story('PR-2', 0, 2, 0, 0)]);
  R.MODULES = { mode: 'none', modules: [], totals: {}, of: {} };
  assert.deepEqual(keys(feCandidates(R, P).now), ['PR-1', 'PR-2']);
});

test('render: escaped titles, friendly text when nothing is ready, contract list collapsed', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 0, 0, { title: '<b>x</b>' }), story('PR-2', 1, 4, 0, 0)]);
  const html = renderFeReady(R, P);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'));
  assert.ok(html.includes('<details') && html.indexOf('PR-1') < html.indexOf('<details') && html.indexOf('PR-2') > html.indexOf('<details'));
  assert.ok(!/undefined|NaN/.test(html));
  const empty = setup([story('PR-3', 3, 4, 3, 3)]);
  const eh = renderFeReady(empty.R, empty.P);
  assert.ok(eh.includes('استوری آماده‌ای') && !eh.includes('<details'));
});
