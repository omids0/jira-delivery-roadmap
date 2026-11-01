import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderNotes } from '../src/render/notes.js';
import { renderRaw } from '../src/render/raw.js';
import { renderSprints } from '../src/render/sprints.js';
import { fixture, baseState } from '../test-support/fixture.js';

function setup(mutate) {
  const ctx = fixture();
  if (mutate) mutate(ctx);
  const state = { ...baseState, own: { BE: {}, FE: {} } };
  const eng = createEngine(ctx);
  const R = createEnv(ctx, eng, state);
  const P = eng.plan(state);
  const crit = eng.criticalChain(P.sched);
  return { ctx, R, P, crit };
}
const clean = (html) => {
  assert.ok(html.length > 50, 'non-empty');
  assert.ok(!/undefined|NaN|\[object/.test(html), 'no undefined/NaN');
};

test('renderNotes: cards, no undefined, no baseline block', () => {
  const { R, P } = setup();
  const html = renderNotes(R, P);
  clean(html);
  assert.equal((html.match(/class="note"/g) || []).length, 6);
  assert.ok(html.includes('گلوگاه'));
  assert.ok(html.includes('P-1'));
  assert.ok(!html.includes('تغییرات نسبت به برآورد پایه'));
});

test('renderNotes: escapes titles', () => {
  const { R, P } = setup((ctx) => { ctx.stories[0].title = '<img src=x onerror=1>'; });
  const html = renderNotes(R, P);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('renderRaw: one row per scheduled task', () => {
  const { R, P, crit } = setup((ctx) => { ctx.stories[0].title = 'A<b>&"'; ctx.EP.e1.n = '<i>epic</i>'; });
  const html = renderRaw(R, P, crit);
  clean(html);
  assert.equal((html.match(/<tr><td class="n">/g) || []).length, P.sched.size);
  assert.ok(html.includes('بله'));
  assert.ok(!html.includes('<b>&"') && !html.includes('<i>epic'));
  assert.ok(html.includes('&lt;i&gt;epic'));
});

test('renderSprints: next card, matrix and legend', () => {
  const { R, P, crit } = setup();
  const { next, matrix, legend } = renderSprints(R, P, crit);
  clean(next);
  clean(matrix);
  clean(legend);
  assert.ok(next.startsWith('<article class="sp-next">'));
  assert.ok(next.includes(R.META.sprintWord));
  assert.ok(matrix.startsWith('<thead>') && matrix.includes('<tbody>') && matrix.includes('<tfoot>'));
  assert.ok(matrix.includes('class="th') || matrix.includes('<th'));
});

test('renderSprints: titles and epic names are escaped', () => {
  const { R, P, crit } = setup((ctx) => {
    ctx.stories.forEach((s) => { s.title = '<script>x</script>'; });
    ctx.EP.e1.n = '<u>e1</u>';
    ctx.NEXT_SPRINT.firstLen = 60; // first sprint holds all the work
  });
  const { next, matrix } = renderSprints(R, P, crit);
  for (const h of [next, matrix]) {
    assert.ok(!h.includes('<script>x'));
    assert.ok(!h.includes('<u>e1'));
  }
  assert.ok(next.includes('&lt;script&gt;'));
});

test('renderSprints: empty plan gives a friendly message', () => {
  const { R, P, crit } = setup();
  const empty = { ...P, sched: new Map(), list: [] };
  R.eng = { ...R.eng, sprintPlan: () => ({ sprints: [] }) };
  const { next, matrix } = renderSprints(R, empty, crit);
  assert.ok(next.includes('lead'));
  assert.equal(matrix, '');
});
