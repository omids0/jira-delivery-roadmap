import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderTeam } from '../src/render/team.js';
import { defaultState, normDevs, normalizeState } from '../src/roadmapState.js';
import { baseState, fixture } from '../test-support/fixture.js';

const setup = (over = {}) => {
  const ctx = fixture();
  const eng = createEngine(ctx);
  const state = { ...baseState, devs: { BE: [], FE: [] }, ...over };
  return { ctx, eng, state, R: createEnv(ctx, eng, state) };
};

test('normDevs: trims names, keeps 0.5..200 paces, drops junk, caps at 6 rows', () => {
  const d = normDevs({ BE: [{ name: '  Ann ', pace: '12.34' }, { name: '', pace: 0 }, { pace: 500 }, null], FE: new Array(9).fill({ name: 'x' }) });
  assert.deepEqual(d.BE, [{ par: null, name: 'Ann', pace: 12.3 }, { par: null, name: null, pace: null }, { par: null, name: null, pace: null }, { par: null, name: null, pace: null }]);
  assert.equal(d.FE.length, 6);
  assert.deepEqual(normDevs(undefined), { BE: [], FE: [] });
});

test('state without devs (saved by an older version) gets empty devs', () => {
  assert.deepEqual(normalizeState({ be: 2 }, defaultState({})).devs, { BE: [], FE: [] });
});

test('a faster developer finishes the same work sooner', () => {
  const { eng, state } = setup();
  const slow = eng.plan(state);
  const fast = eng.plan({ ...state, devs: { BE: [{ name: null, pace: eng.PACE.avg.BE * 2 }], FE: [] } });
  const beDur = (P) => [...P.sched.values()].filter((v) => v.t.role === 'BE').reduce((a, v) => a + v.t.dur, 0);
  assert.ok(Math.abs(beDur(fast) - beDur(slow) / 2) < 0.2, `${beDur(fast)} vs ${beDur(slow)}`);
  assert.ok(fast.span <= slow.span + 1e-9);
});

test('devPaces: own figure when set, scenario pace otherwise', () => {
  const { eng, state } = setup({ be: 2 });
  const p = eng.devPaces({ ...state, devs: { BE: [{ name: null, pace: 20 }], FE: [] } });
  assert.deepEqual(p.BE, [20, eng.PACE.avg.BE]);
  assert.deepEqual(p.FE, [eng.PACE.avg.FE]);
});

test('owners: the faster developer is given more of the work', () => {
  const { eng, state } = setup({ be: 2 });
  const P = eng.plan({ ...state, devs: { BE: [{ name: null, pace: 60 }, { name: null, pace: 5 }], FE: [] } });
  assert.ok(P.owners.load.BE[0] >= P.owners.load.BE[1]);
});

test('sprint capacity sums the people\'s own paces', () => {
  const { eng, state } = setup({ be: 2 });
  const s = { ...state, devs: { BE: [{ name: null, pace: 10 }, { name: null, pace: 30 }], FE: [] } };
  const { sprints } = eng.sprintPlan(eng.plan(s), s);
  assert.ok(sprints.length);
  assert.equal(sprints[0].cap.BE, 40 * sprints[0].days);
});

test('env: named team members replace the auto-detected people and map to Jira names', () => {
  const { R, state } = setup();
  assert.notEqual(R.personName('BE', 0), 'Zoe');
  state.devs = { BE: [{ name: 'Zoe', pace: null }], FE: [] };
  assert.equal(R.personName('BE', 0), 'Zoe');
  assert.deepEqual(R.PEOPLE.find((p) => p.role === 'BE' && p.n === 1).jira, ['Zoe']);
});

test('team panel: one row per developer, pick-list of Jira people, escaped values, scenario pace as placeholder', () => {
  const { R, state } = setup({ be: 2, fe: 1 });
  state.devs = { BE: [{ name: '"><b>x', pace: 9 }], FE: [] };
  const html = renderTeam(R);
  assert.equal((html.match(/class="dev-name"/g) || []).length, 3);
  assert.ok(html.includes('value="&quot;&gt;&lt;b&gt;x"') && html.includes('value="9"'));
  assert.ok(html.includes('<datalist id="jr-people">') && html.includes('<option value="Bea">'));
  assert.ok(!/undefined|NaN/.test(html));
});

test('parallel stories are set per person: a developer running more at once gets more lanes and longer stories', () => {
  const { eng, state } = setup();
  const one = eng.plan({ ...state, par: 1, devs: { BE: [{ name: null, pace: null, par: 1 }], FE: [] } });
  const three = eng.plan({ ...state, par: 1, devs: { BE: [{ name: null, pace: null, par: 3 }], FE: [] } });
  assert.deepEqual(three.pars.BE, [3]);
  assert.deepEqual(one.pars.BE, [1]);
  const beDur = (P) => [...P.sched.values()].filter((v) => v.t.role === 'BE').reduce((a, v) => a + v.t.dur, 0);
  assert.ok(Math.abs(beDur(three) - 3 * beDur(one)) < 0.2, `${beDur(three)} vs ${beDur(one)}`);
});

test('devPars: own figure when set, the default otherwise, clamped to 1..6', () => {
  const { eng, state } = setup({ be: 3, par: 2 });
  const p = eng.devPars({ ...state, be: 3, devs: { BE: [{ par: 5 }, { par: 99 }, {}], FE: [] } });
  assert.deepEqual(p.BE, [5, 6, 2]);
  assert.deepEqual(p.FE, [2]);
});

test('team panel has a parallel-stories field per person', () => {
  const { R, state } = setup({ be: 2, fe: 1 });
  state.devs = { BE: [{ name: null, pace: null, par: 4 }], FE: [] };
  const html = renderTeam(R);
  assert.equal((html.match(/class="dev-par-in"/g) || []).length, 3);
  assert.ok(html.includes('value="4"'));
});
