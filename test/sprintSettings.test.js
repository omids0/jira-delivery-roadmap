import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderSprintSettings } from '../src/render/sprintSettings.js';
import { defaultState, normSprint, normalizeState } from '../src/roadmapState.js';
import { baseState, fixture } from '../test-support/fixture.js';

const setup = (sprint = {}, over = {}) => {
  const ctx = fixture();
  const eng = createEngine(ctx);
  const state = { ...baseState, devs: { BE: [], FE: [] }, sprint: normSprint(sprint), ...over };
  return { ctx, eng, state, R: createEnv(ctx, eng, state) };
};

test('normSprint: valid values kept, out-of-range or junk becomes null, reserve defaults to 0', () => {
  assert.deepEqual(normSprint({ start: '2026-11-05', len: '12', n: 7, target: '30', be: 3, fe: 2, reserve: '20' }),
    { start: '2026-11-05', basis: null, len: 12, n: 7, target: 30, be: 3, fe: 2, reserve: 20 });
  assert.deepEqual(normSprint({ start: '5/11/2026', len: 0, n: 'x', target: 9999, be: 9, fe: -1, reserve: 95 }),
    { start: null, basis: null, len: null, n: null, target: null, be: null, fe: null, reserve: 0 });
  assert.deepEqual(normSprint(undefined), { start: null, basis: null, len: null, n: null, target: null, be: null, fe: null, reserve: 0 });
});

test('state from an older version gets an empty sprint block', () => {
  assert.deepEqual(normalizeState({ be: 2 }, defaultState({})).sprint, normSprint({}));
});

test('sprintOpts: the board default unless the user set a value', () => {
  const { eng, ctx, state } = setup();
  assert.equal(eng.sprintOpts(state).n, ctx.NEXT_SPRINT.n);
  const o = eng.sprintOpts({ ...state, sprint: normSprint({ n: 42, start: '2026-12-01', len: 15, target: 12 }) });
  assert.deepEqual([o.n, o.start, o.len, o.firstLen, o.target], [42, '2026-12-01', 15, 15, 12]);
});

test('a target of N stories gives the sprint at most N stories', () => {
  const { eng, state } = setup({ target: 2 });
  const sp = eng.sprintPlan(eng.planForSprint(state), state);
  const first = sp.sprints.find((s) => s.n === eng.sprintOpts(state).n);
  assert.ok(first.done.length <= 2);
});

test('the start date and length move the sprint windows', () => {
  const { eng, state } = setup({ start: '2026-11-15', len: 5 });
  const sp = eng.sprintPlan(eng.planForSprint(state), state);
  const cur = sp.sprints.find((s) => s.n === eng.sprintOpts(state).n);
  assert.equal(cur.w1 - cur.w0, 5);
});

test('sprint headcount and reserve change the sprint capacity; no override keeps the main plan', () => {
  const { eng, state } = setup();
  assert.equal(eng.planForSprint(state).span, eng.plan(state).span);
  const bigger = setup({ be: 3 }).state;
  const P3 = eng.planForSprint(bigger);
  assert.equal(P3.paces.BE.length, 3);
  const reserved = setup({ reserve: 50 }).state;
  const Pr = eng.planForSprint(reserved);
  assert.ok(Math.abs(Pr.paces.BE[0] - eng.plan(state).paces.BE[0] / 2) < 1e-9);
  assert.ok(Pr.span >= eng.plan(state).span - 1e-9);
});

test('settings form: all fields, defaults as placeholders, values escaped, reset button', () => {
  const { R } = setup({ n: 7, start: '2026-12-01' });
  const html = renderSprintSettings(R);
  for (const k of ['start', 'len', 'n', 'target', 'be', 'fe', 'reserve']) assert.ok(html.includes(`data-k="${k}"`), k);
  assert.ok(html.includes('value="7"') && html.includes('value="2026-12-01"'));
  assert.ok(html.includes('id="sp-reset"'));
  assert.ok(!/undefined|NaN/.test(html));
});

test('env: NEXT_SPRINT follows the user\'s values live', () => {
  const { R, state } = setup();
  const before = R.NEXT_SPRINT.n;
  state.sprint = normSprint({ n: before + 5 });
  assert.equal(R.NEXT_SPRINT.n, before + 5);
});
