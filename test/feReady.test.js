import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { feCandidates, renderFeReady } from '../src/render/feReady.js';
import { baseState, fixture } from '../test-support/fixture.js';

const story = (k, beOpen, beTotal, feOpen, feTotal, extra = {}) => ({
  k, ep: 'e1', title: `Story ${k}`, be: 5, fe: 4, deps: [], f: [], known: { ...(beTotal ? { be: beOpen } : {}), ...(feTotal ? { fe: feOpen } : {}) },
  done: false, res: null, hist: false, subs: { be: { open: beOpen, total: beTotal }, fe: { open: feOpen, total: feTotal } }, ...extra
});

const setup = (stories) => {
  const base = fixture();
  const ctx = { ...base, stories };
  const eng = createEngine(ctx);
  const R = createEnv(ctx, eng, { ...baseState, devs: { BE: [], FE: [] } });
  return { R, P: eng.plan(R.state) };
};

test('back-end finished with front-end left is ready; over half done can start from the contract; less cannot', () => {
  const { R, P } = setup([
    story('PR-1', 0, 3, 2, 2), // back-end done
    story('PR-2', 2, 4, 3, 3), // exactly half
    story('PR-3', 3, 4, 3, 3), // a quarter
    story('PR-4', 0, 3, 0, 2), // front-end done too
    story('PR-5', 0, 0, 3, 3, { be: 0 }) // front-end only work
  ]);
  const c = feCandidates(R, P);
  assert.deepEqual(c.ready.map((x) => x.s.k).sort(), ['PR-1', 'PR-5']);
  assert.deepEqual(c.contract.map((x) => x.s.k), ['PR-2']);
});

test('a story that waits on an open story is marked and sorted after the free ones', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 2, 2, { deps: ['PR-9'] }), story('PR-2', 0, 3, 2, 2), story('PR-9', 5, 5, 5, 5)]);
  const { ready } = feCandidates(R, P);
  assert.deepEqual(ready.map((x) => x.s.k), ['PR-2', 'PR-1']);
  assert.deepEqual(ready[1].waits, ['PR-9']);
});

test('stories in the running sprint are flagged', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 2, 2)]);
  R.CURRENT_SPRINT = { epics: [{ items: [{ k: 'PR-1' }] }] };
  assert.ok(feCandidates(R, P).ready[0].sprint);
});

test('table: groups with counts, escaped titles, friendly text when nothing is ready', () => {
  const { R, P } = setup([story('PR-1', 0, 3, 2, 2, { title: '<b>x</b>' }), story('PR-2', 2, 4, 3, 3)]);
  const html = renderFeReady(R, P);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'));
  assert.ok(html.includes('بک‌اند تمام شده و فرانت مانده') && html.includes('قرارداد API'));
  assert.ok(!/undefined|NaN/.test(html));
  const empty = setup([story('PR-3', 3, 4, 3, 3)]);
  assert.ok(renderFeReady(empty.R, empty.P).includes('فعلاً استوری‌ای نیست'));
});
