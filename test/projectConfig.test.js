import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProjectConfig } from '../src/projectConfig.js';

const file = {
  defaults: { components: { be: 'Back-End', fe: 'Front-End' }, weekend: [4, 5], parallelStories: 3 },
  projects: { ABC: { components: { fe: 'UI' }, weekend: [5, 6] } }
};

test('unknown project gets the defaults', () => {
  assert.deepEqual(makeProjectConfig(file)('XYZ'), file.defaults);
});

test('project override merges objects key by key and replaces arrays', () => {
  const cfg = makeProjectConfig(file)('ABC');
  assert.deepEqual(cfg.components, { be: 'Back-End', fe: 'UI' });
  assert.deepEqual(cfg.weekend, [5, 6]);
  assert.equal(cfg.parallelStories, 3);
});

test('missing file gives an empty config', () => {
  assert.deepEqual(makeProjectConfig(undefined)('ABC'), {});
});
