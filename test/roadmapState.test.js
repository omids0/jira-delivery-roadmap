import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, loadState, normOwn, normalizeState, saveState, stateKey } from '../src/roadmapState.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const cfg = { team: { be: 2, fe: 1 }, parallelStories: 3 };

test('defaults come from the project config', () => {
  assert.deepEqual(defaultState(cfg), { be: 2, fe: 1, par: 3, pace: 'avg', p2: true, p3: true, def: false, hist: true, own: { BE: {}, FE: {} }, devs: { BE: [], FE: [] }, sprint: { start: null, basis: null, len: null, n: null, target: null, be: null, fe: null, reserve: 0 } });
});

test('numbers are clamped to 1..6, junk falls back, pace must be a known scenario', () => {
  const s = normalizeState({ be: 99, fe: 'x', par: 0, pace: 'wild', def: true }, defaultState(cfg));
  assert.equal(s.be, 6);
  assert.equal(s.fe, 1);
  assert.equal(s.par, 1);
  assert.equal(s.pace, 'avg');
  assert.equal(s.def, true);
});

test('owners keep only epic-key entries with non-negative integer developers', () => {
  assert.deepEqual(normOwn({ BE: { 'ABC-1': 1, e3: 0, 'ABC-2': -1, 'ABC-3': 1.5 }, FE: { 'ABC-9': 0 } }), { BE: { 'ABC-1': 1 }, FE: { 'ABC-9': 0 } });
  assert.deepEqual(normOwn(null), { BE: {}, FE: {} });
});

test('save then load round-trips; a corrupt value gives the defaults', () => {
  const st = mem();
  const k = stateKey('jira.example.com', 'ABC');
  saveState(st, k, { ...defaultState(cfg), be: 4, own: { BE: { 'ABC-1': 2 }, FE: {} } });
  const s = loadState(st, k, cfg);
  assert.equal(s.be, 4);
  assert.deepEqual(s.own.BE, { 'ABC-1': 2 });
  st.setItem(k, '{nope');
  assert.deepEqual(loadState(st, k, cfg), defaultState(cfg));
});
