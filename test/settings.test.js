import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, normalizeSettings, saveSettings, settingsKey } from '../src/settings.js';

const base = { team: { be: 1, fe: 1 }, parallelStories: 3, components: { be: 'Back-End', fe: 'Front-End' } };

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

test('empty input gives the defaults', () => {
  assert.deepEqual(normalizeSettings(undefined, base), base);
});

test('numbers are clamped and junk falls back', () => {
  const s = normalizeSettings({ team: { be: '99', fe: 'abc' }, parallelStories: '0' }, base);
  assert.equal(s.team.be, 20);
  assert.equal(s.team.fe, 1);
  assert.equal(s.parallelStories, 1);
});

test('component names are trimmed; blank falls back', () => {
  const s = normalizeSettings({ components: { be: '  API  ', fe: '   ' } }, base);
  assert.deepEqual(s.components, { be: 'API', fe: 'Front-End' });
});

test('save then load round-trips per project key', () => {
  const st = memory();
  const k = settingsKey('jira.example.com', 'ABC');
  assert.equal(saveSettings(st, k, normalizeSettings({ team: { be: 3, fe: 2 } }, base)), true);
  assert.equal(loadSettings(st, k, base).team.be, 3);
  assert.equal(loadSettings(st, settingsKey('jira.example.com', 'XYZ'), base).team.be, 1);
});

test('corrupt storage value is ignored', () => {
  const st = memory();
  st.setItem('k', '{not json');
  assert.deepEqual(loadSettings(st, 'k', base), base);
});

test('storage that throws on write reports failure', () => {
  const st = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(saveSettings(st, 'k', base), false);
});
