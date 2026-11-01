import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../src/adapter.js';
import { createEngine } from '../src/engine.js';
import { buildModel } from '../src/model.js';
import { createEnv } from '../src/render/env.js';
import { renderPeople } from '../src/render/people.js';
import { baseState, fixture } from '../test-support/fixture.js';

const st = (c) => ({ name: c, statusCategory: { key: c, name: c } });
const sub = (key, role, who) => ({ key, fields: { summary: 'x', status: st('new'), components: [{ name: role === 'be' ? 'Back-End' : 'Front-End' }], labels: [], parent: { key: 'P-1' }, assignee: { displayName: who }, resolutiondate: null } });
const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: {}, weekend: [4, 5], locale: 'en-US' };

test('a person with sub-tasks in both roles is listed once, in the role where they do more (tie: back-end)', () => {
  const subtasks = [
    ...['a1', 'a2', 'a3'].map((k) => sub(k, 'be', 'Ann')), sub('a4', 'fe', 'Ann'),
    sub('b1', 'be', 'Bob'), sub('b2', 'fe', 'Bob'), sub('b3', 'fe', 'Bob'),
    sub('c1', 'be', 'Cy'), sub('c2', 'fe', 'Cy')
  ];
  const raw = { epics: [], stories: [{ key: 'P-1', fields: { summary: 's', status: st('new'), labels: [], components: [], issuelinks: [], customfield_1: null, assignee: null, resolutiondate: null } }], subtasks, epicField: 'customfield_1', assigned: [], sprints: [] };
  const ctx = buildContext({ raw, model: buildModel(raw, cfg), sprints: [], assigned: [], cfg, baseUrl: 'https://jira.example', project: 'P', now: new Date(2026, 9, 20) });
  const where = Object.fromEntries(ctx.people.map((p) => [p.name, p.role]));
  assert.deepEqual(where, { Ann: 'BE', Cy: 'BE', Bob: 'FE' });
  assert.equal(new Set(ctx.people.map((p) => p.name)).size, ctx.people.length);
});

test('open-work cards: one card per Jira person even when two slots point at the same name', () => {
  const ctx = {
    ...fixture(),
    people: [{ role: 'BE', n: 1, name: 'Ann', jira: ['Ann'] }, { role: 'FE', n: 1, name: 'Ann', jira: ['Ann'] }],
    ASSIGNED: [['PR-1', 'Task', 'work', 'To Do', 'To Do', 'Ann', null, null, 'Low', '2026-10-01']]
  };
  const R = createEnv(ctx, createEngine(ctx), { ...baseState, be: 1, fe: 1, devs: { BE: [], FE: [] } });
  const html = renderPeople(R);
  assert.equal((html.match(/<details class="person"/g) || []).length, 1);
  assert.ok(html.includes('PR-1'));
});

test('two team slots named the same person show one card; an empty slot still shows', () => {
  const ctx = { ...fixture(), people: [], ASSIGNED: [] };
  const state = { ...baseState, be: 2, fe: 1, devs: { BE: [{ name: 'Zoe', pace: null, par: null }, { name: 'Zoe', pace: null, par: null }], FE: [] } };
  const html = renderPeople(createEnv(ctx, createEngine(ctx), state));
  assert.equal((html.match(/<details class="person"/g) || []).length, 2); // Zoe once + the unnamed front-end slot
});
