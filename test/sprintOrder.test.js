import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, findOverlaps } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderSprintOrder } from '../src/render/sprintOrder.js';
import { baseState, fixture } from '../test-support/fixture.js';

const story = (k, ep, beOpen, feOpen, extra = {}) => ({
  k, ep, title: `Story ${k}`, be: 5, fe: 4, deps: [], f: [], known: { be: beOpen, fe: feOpen },
  done: false, res: null, hist: false, subs: { be: { open: beOpen, total: beOpen }, fe: { open: feOpen, total: feOpen } }, ...extra
});

function setup(stories, over = {}) {
  const ctx = { ...fixture(), stories, DEP_INFO: {} };
  const eng = createEngine(ctx);
  const state = { ...baseState, devs: { BE: [], FE: [] }, ...over };
  const R = createEnv(ctx, eng, state);
  R.CURRENT_SPRINT = { epics: [] };
  return { eng, state, R, P: eng.plan(state) };
}

const stories = () => [
  story('PR-1', 'e1', 6, 4, { f: ['ip'] }),
  story('PR-2', 'e1', 6, 4, { deps: ['PR-1'] }),
  story('PR-3', 'e1', 6, 0),
  story('PR-4', 'e2', 6, 4, { deps: ['PR-9'] }),
  story('PR-9', 'e2', 6, 4)
];
const keys = ['PR-1', 'PR-2', 'PR-3', 'PR-4'];

test('a story that waits on an open story outside the sprint is reported, not scheduled', () => {
  const { eng, state, P } = setup(stories());
  const N = eng.planSprintNow(state, P, keys, 8);
  assert.deepEqual(N.blocked.map((b) => [b.s.k, b.outside]), [['PR-4', ['PR-9']]]);
  assert.ok(![...N.sched.keys()].some((id) => id.startsWith('PR-4')));
});

test('dependencies inside the sprint are kept; the story in progress goes first', () => {
  const { eng, state, P } = setup(stories());
  const N = eng.planSprintNow(state, P, keys, 8);
  assert.equal(N.sched.get('PR-1:BE').s, 0);
  assert.ok(N.sched.get('PR-2:BE').s >= N.sched.get('PR-1:BE').e - 1e-9);
  assert.ok(N.sched.get('PR-1:FE').e >= N.sched.get('PR-1:BE').e + 0.1 - 1e-9); // front-end after the back-end of the same story
});

test('nothing overlaps: no two stories of one epic at once on a person, no two in one slot', () => {
  for (const over of [{}, { be: 2, fe: 2, par: 2 }, { par: 3 }]) {
    const { eng, state, P } = setup(stories(), over);
    const N = eng.planSprintNow(state, P, keys, 8);
    assert.deepEqual(findOverlaps(N), [], JSON.stringify(over));
  }
});

test('findOverlaps does detect an overlap', () => {
  const t = (id, ep) => ({ id, role: 'BE', s: { ep } });
  const P = { sched: new Map([['a', { t: t('a', 'e1'), s: 0, e: 3, lane: 0, slot: 0 }], ['b', { t: t('b', 'e1'), s: 2, e: 4, lane: 0, slot: 1 }], ['c', { t: t('c', 'e2'), s: 1, e: 2, lane: 0, slot: 0 }]]) };
  assert.deepEqual(findOverlaps(P).map((x) => x.kind).sort(), ['epic', 'slot']);
});

test('the same people own the same epics as in the main plan', () => {
  const { eng, state, P } = setup(stories(), { be: 2 });
  const N = eng.planSprintNow(state, P, keys, 8);
  for (const [code, idx] of Object.entries(N.owners.own.BE)) assert.equal(idx, P.owners.own.BE[code], code);
});

test('horizon counts today when it is a workday; stories ending after it are flagged as overflow', () => {
  const { eng, state, P } = setup(stories());
  const N = eng.planSprintNow(state, P, keys, 1);
  assert.equal(N.horizon, 2);
  const html = renderSprintOrder(createEnv(fixture(), eng, state), N);
  assert.equal(html, ''); // no running sprint in this environment
});

test('card: ordered list per person, blocked stories listed, escaped, and the overlap check shown', () => {
  const list = stories();
  list[0].title = '<b>x</b>';
  const { eng, state, R, P } = setup(list);
  const html = renderSprintOrder(R, eng.planSprintNow(state, P, keys, 8));
  assert.ok(html.includes('ترتیب پیشنهادی کار تا پایان اسپرینت جاری'));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'));
  assert.ok(html.includes('ندارد ✓') && html.includes('منتظر') && html.includes('PR-9'));
  assert.ok(html.includes('class="ord-lane"') && html.includes('پایان اسپرینت'));
  assert.ok(!/undefined|NaN/.test(html));
  assert.equal(renderSprintOrder(R, null), '');
});
