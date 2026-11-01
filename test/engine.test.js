import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { deriveSprints, nextSprint } from '../src/sprints.js';

import { baseState as state, fixture } from '../test-support/fixture.js';
test('context: epics get codes and colours, stories keep dependencies and done state', () => {
  const ctx = fixture();
  assert.deepEqual(ctx.EP_ORDER, ['e1', 'e2', 'oth']);
  assert.equal(ctx.EP.e1.k, 'P-100');
  const p2 = ctx.stories.find((s) => s.k === 'P-2');
  assert.deepEqual(p2.deps, ['P-1']);
  assert.deepEqual(p2.known, { be: 12, fe: 6 });
  assert.equal(ctx.stories.find((s) => s.k === 'P-5').done, true);
});

test('sprint history gives measured pace; no history falls back to the default pace', () => {
  const ctx = fixture();
  const e = createEngine(ctx);
  assert.equal(ctx.SPRINTS.length, 1);
  assert.ok(e.PACE.avg.BE > 0 && e.PACE.avg.FE > 0);
  const none = createEngine({ ...ctx, SPRINTS: [] });
  assert.equal(none.PACE.avg.BE, 12);
  assert.equal(none.PACE.opt.BE, 15);
});

test('plan: a dependent story never starts before its blocker ends; FE follows BE (contract-first)', () => {
  const e = createEngine(fixture());
  const P = e.plan(state);
  const at = (id) => P.sched.get(id);
  assert.ok(at('P-2:BE').s >= at('P-1:BE').e - 1e-9);
  assert.ok(at('P-3:BE').s >= at('P-2:BE').e - 1e-9);
  assert.ok(at('P-1:FE').s >= at('P-1:BE').s + 0.5 * at('P-1:BE').e - 0.5 * at('P-1:BE').s - 1e-9 || at('P-1:FE').s >= at('P-1:BE').s);
  assert.ok(at('P-1:FE').e >= at('P-1:BE').e + 0.1 - 1e-9);
  assert.ok(P.span > 0);
});

test('plan: more people never finishes later', () => {
  const e = createEngine(fixture());
  const one = e.plan(state).span;
  const two = e.plan({ ...state, be: 2, fe: 2 }).span;
  assert.ok(two <= one + 1e-9);
});

test('plan: done stories carry no work; the critical chain ends at the last task', () => {
  const e = createEngine(fixture());
  const P = e.plan(state);
  assert.ok(![...P.sched.keys()].some((id) => id.startsWith('P-5')));
  const chain = e.criticalChain(P.sched);
  assert.ok(chain.size > 0);
  const last = [...P.sched.values()].reduce((a, b) => (b.e > a.e ? b : a));
  assert.ok(chain.has(last.t.id));
});

test('plan: unlimited people is a lower bound for the scheduled span', () => {
  const e = createEngine(fixture());
  const P = e.plan(state);
  assert.ok(e.unlimited(P.tasks) <= P.span + 1e-9);
});

test('sprint plan: starts after the active sprint and every open story lands in some sprint', () => {
  const ctx = fixture();
  assert.equal(ctx.NEXT_SPRINT.n, 5);
  assert.equal(ctx.NEXT_SPRINT.start, '2026-10-25');
  const e = createEngine(ctx);
  const P = e.plan(state);
  const { sprints } = e.sprintPlan(P, state);
  const placed = new Set(sprints.flatMap((s) => s.done.map((o) => o.story.k)));
  for (const s of P.list.filter((x) => !x.done && !x.rc)) assert.ok(placed.has(s.k), s.k);
});

test('epic finish covers every epic that has scheduled work', () => {
  const e = createEngine(fixture());
  const fin = e.epicFinish(e.plan(state));
  assert.ok(fin.e1.e > 0 && fin.e2.e > fin.e2.s);
});

test('deriveSprints / nextSprint edge cases', () => {
  assert.deepEqual(deriveSprints([], { subtasks: [], stories: [] }, { weekend: [4, 5] }), []);
  const n = nextSprint([], { today: new Date(2026, 9, 20) });
  assert.equal(n.n, 1);
  assert.equal(n.sprintWord, 'Sprint');
});
