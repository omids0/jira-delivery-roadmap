import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderKpis, renderWhatIf, legendHTML, computeSummary } from '../src/render/kpis.js';
import { renderVelocity } from '../src/render/velocity.js';
import { renderOverview } from '../src/render/overview.js';
import { baseState, fixture } from '../test-support/fixture.js';

const NASTY = '<img src=x onerror=alert(1)> & "q"';

function setup(mutate) {
  const ctx = fixture();
  if (mutate) mutate(ctx);
  const state = { ...baseState, own: { BE: {}, FE: {} } };
  const eng = createEngine(ctx);
  const R = createEnv(ctx, eng, state);
  const P = eng.plan(state);
  return { ctx, eng, R, P, crit: eng.criticalChain(P.sched) };
}

const clean = (html) => {
  assert.ok(html.length > 0);
  assert.ok(!/undefined|NaN|ناعدد|\[object/.test(html), 'no undefined / NaN: ' + html.match(/.{30}(undefined|NaN|ناعدد|\[object).{30}/)?.[0]);
};

test('kpis: six cards, summary numbers sane', () => {
  const { R, P, crit } = setup();
  const html = renderKpis(R, P, crit);
  clean(html);
  assert.equal((html.match(/class="kpi /g) || []).length, 6);
  assert.equal((html.match(/class="kpi hero"/g) || []).length, 2);
  const m = computeSummary(R, P, crit);
  assert.ok(m.spanW > 0 && m.jiraStories === 4 && m.totalReal === 5);
  assert.ok(m.critStories.size > 0);
  assert.ok(m.minSpan > 0 && m.minSpan <= P.span - P.off + 1e-9);
});

test('kpis: works without crit argument and with an empty plan', () => {
  const { R, P } = setup();
  clean(renderKpis(R, P));
  const empty = setup((ctx) => { ctx.stories = []; });
  clean(renderKpis(empty.R, empty.P, empty.crit));
  clean(renderWhatIf(empty.R, empty.P, empty.crit));
});

test('what-if and legends', () => {
  const { R, P, crit } = setup();
  const w = renderWhatIf(R, P, crit);
  clean(w);
  assert.equal((w.match(/<span>/g) || []).length, 4);
  assert.ok(w.includes('مسیر بحرانی'));
  const flow = legendHTML(R, false);
  const gantt = legendHTML(R, true);
  clean(flow);
  clean(gantt);
  assert.ok(gantt.includes('class="sw crit"') && !flow.includes('class="sw crit"'));
  assert.ok(flow.includes('تصمیم باز'));
});

test('velocity: one row per closed sprint plus the pace row', () => {
  const { R, ctx } = setup((c) => { c.SPRINTS[0].n = NASTY; });
  const { table, note } = renderVelocity(R);
  clean(table);
  clean(note);
  assert.equal((table.match(/<tr>/g) || []).length, ctx.SPRINTS.length + 1);
  assert.ok(table.includes('class="sum"') && table.includes('class="rate"'));
  assert.ok(!table.includes('<img') && table.includes('&lt;img'));
  assert.ok(note.includes('sub-task'));
});

test('velocity: no closed sprints gives the calibration hint', () => {
  const { R } = setup((c) => { c.SPRINTS = []; });
  const { table, note } = renderVelocity(R);
  clean(table);
  clean(note);
  assert.ok(note.includes('هنوز اسپرینت بسته‌شده‌ای'));
});

test('overview: progress, legend and map structure', () => {
  const { R, P } = setup();
  const { progress, map, legend } = renderOverview(R, P);
  clean(progress);
  clean(map);
  clean(legend);
  assert.ok(progress.includes('class="pbig"') && progress.includes('class="ov-stats"'));
  for (const cls of ['ov-head', 'ov-hist', 'ov-group', 'ov-plan', 'ov-dot', 'ov-end', 'ov-vl today', 'tick']) assert.ok(map.includes(cls), cls);
  assert.ok(map.includes('href="https://jira.example/browse/P-5"'));
  assert.ok(map.includes('اپیک‌های در جریان'));
  assert.ok(map.includes('Epic 100') && map.includes('Epic 200'));
});

test('overview: HTML-special characters in titles and epic names are escaped', () => {
  const { R, P } = setup((ctx) => {
    ctx.stories.find((s) => s.k === 'P-5').title = NASTY;
    ctx.EP.e1.n = NASTY;
    ctx.SPRINT_MARKS = [[NASTY, '2026-10-10']];
  });
  const { map } = renderOverview(R, P);
  clean(map);
  assert.ok(!map.includes('<img') && !map.includes('onerror=alert(1)>'));
  assert.ok(map.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;'));
});

test('overview: empty plan renders without NaN', () => {
  const { R, P } = setup((ctx) => { ctx.stories = []; });
  const { progress, map } = renderOverview(R, P);
  clean(progress);
  clean(map);
});
