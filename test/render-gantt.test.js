import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, baseState } from '../test-support/fixture.js';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderGantt } from '../src/render/gantt.js';
import { renderEpics } from '../src/render/epics.js';
import { renderOwners } from '../src/render/owners.js';
import { renderPeople } from '../src/render/people.js';
import { bindOwners } from '../src/browser/owners-ui.js';

function setup(over = {}, mutate) {
  const ctx = fixture();
  ctx.EP.e1.n = '<img src=x onerror=1>Epic';
  ctx.stories[0].title = '<script>alert(1)</script>';
  ctx.people = [{ role: 'BE', n: 1, name: 'Bea <b>', jira: ['Bea'] }, { role: 'FE', n: 1, name: 'Fay', jira: ['Fay'] }];
  ctx.ASSIGNED = [
    ['PR-1', 'Story', 'Do <thing>', 'In Progress', 'In Progress', 'Bea', null, 'P-100', 'High', '2026-10-18'],
    ['PR-2', 'Sub-task', 'Sub', 'To Do', 'To Do', 'Bea', 'PR-1', 'P-100', 'Medium', '2026-10-19'],
    ['PR-9', 'Bug', 'Stray', 'To Do', 'To Do', 'Zed <x>', null, null, '', '']
  ];
  if (mutate) mutate(ctx);
  const eng = createEngine(ctx);
  const state = { ...baseState, own: { BE: {}, FE: {} }, ...over };
  const R = createEnv(ctx, eng, state);
  const P = eng.plan(state);
  return { ctx, eng, state, R, P };
}
const clean = (html) => {
  assert.ok(html.length > 0);
  assert.ok(!/undefined|NaN/.test(html), 'no undefined/NaN: ' + (html.match(/.{30}(undefined|NaN).{30}/) || [])[0]);
};

test('gantt: structure, data-id bars, index, escaping', () => {
  const { R, P, eng } = setup({ be: 2, fe: 1, par: 2 }, (ctx) => { const d = ctx.stories.find((x) => x.k === 'P-5'); d.res = '2026-10-19'; d.hist = false; });
  const crit = eng.criticalChain(P.sched);
  const { html, index } = renderGantt(R, P, crit);
  clean(html);
  assert.match(html, /class="g-row g-head"/);
  assert.match(html, /class="gate-line today"/);
  assert.match(html, /class="g-row mile-row"/);
  assert.match(html, /class="dpill/); // P-5 is closed
  const ids = [...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, P.sched.size);
  ids.forEach((id) => assert.ok(index[id], id));
  assert.equal(Object.keys(index).length, P.sched.size);
  assert.match(html, /class="bar[^"]*crit/);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('خط موازی'));
});

test('gantt: works without history axis and with no open work', () => {
  const { R, P, eng } = setup({ hist: false });
  clean(renderGantt(R, P, eng.criticalChain(P.sched)).html);
  const s2 = setup({ be: 1, fe: 1 }, (ctx) => { ctx.stories.forEach((s) => { s.done = true; }); });
  const out = renderGantt(s2.R, s2.P, s2.eng.criticalChain(s2.P.sched));
  clean(out.html);
  assert.equal(Object.keys(out.index).length, 0);
});

test('epics table: rows, closed epic, escaping', () => {
  const { R, P } = setup();
  const html = renderEpics(R, P);
  clean(html);
  assert.match(html, /<thead>/);
  assert.match(html, /href="https:\/\/jira\.example\/browse\/P-100"/);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.match(html, /class="span"/);
  // an epic whose open work is all closed shows as finished
  const s2 = setup({}, (ctx) => { ctx.stories.filter((s) => s.ep === 'e2').forEach((s) => { s.done = true; }); });
  assert.match(renderEpics(s2.R, s2.P), /تمام شد/);
});

test('owners table: selects for several developers, plain name for one', () => {
  const one = setup();
  const o1 = renderOwners(one.R, one.P);
  clean(o1.table);
  assert.ok(!o1.table.includes('<select'));
  const { R, P } = setup({ be: 2, fe: 2, own: { BE: { 'P-100': 1 }, FE: {} } });
  const o = renderOwners(R, P);
  clean(o.table);
  clean(o.summary);
  assert.match(o.table, /<select data-r="BE" data-ep="e1"/);
  assert.match(o.table, /<select data-r="FE"/);
  assert.match(o.table, /<option value="1" selected>/); // manual choice
  assert.match(o.table, /<small class="auto">/); // others are automatic
  assert.ok(o.table.includes('&lt;img'));
  assert.ok(o.summary.includes('sub-task') && o.summary.includes('|'));
  assert.ok(!o.summaryHtml.includes('<b>'));
});

test('people: members, unmapped users, escaping', () => {
  const { R } = setup();
  const html = renderPeople(R);
  clean(html);
  assert.equal((html.match(/class="person"/g) || []).length, 3); // Bea, Fay, Zed
  assert.ok(html.includes('Bea &lt;b&gt;'));
  assert.ok(html.includes('Zed &lt;x&gt;'));
  assert.ok(!html.includes('<b>Bea'));
  assert.ok(html.includes('Do &lt;thing&gt;'));
  assert.match(html, /class="tg ip"/);
  assert.match(html, /class="tg ext">High</);
  assert.match(html, /href="https:\/\/jira\.example\/browse\/PR-1"/);
  assert.ok(html.includes('در Jira کار بازی به این نفر assign نشده است') || html.includes('کار باز'));
});

test('bindOwners: delegated change pins the split, auto button resets, unbind works', () => {
  const { R, P } = setup({ be: 2, fe: 2 });
  const doc = new EventTarget();
  const calls = [];
  const mkSel = (r, ep, value) => ({ dataset: { r, ep }, value: String(value), closest: (q) => (q === '#own-tbl' ? {} : null) });
  const hooks = { getP: () => P, setOwn: (o) => calls.push(['own', o]), rerender: () => calls.push(['render']) };
  bindOwners(R, doc, hooks);
  bindOwners(R, doc, hooks); // idempotent: still a single listener
  const fire = (type, target) => { const ev = new Event(type); Object.defineProperty(ev, 'target', { value: target }); doc.dispatchEvent(ev); };
  fire('change', mkSel('BE', 'e2', 1));
  assert.equal(calls.length, 2);
  const next = calls[0][1];
  assert.equal(next.BE['P-200'], 1);
  assert.equal(next.BE['P-100'], P.owners.own.BE.e1); // other epic pinned at its current value
  assert.deepEqual(next.FE, {});
  fire('click', { closest: (q) => (q === '#own-auto' ? {} : null) });
  assert.deepEqual(calls[2][1], { BE: {}, FE: {} });
  assert.equal(calls.length, 4);
  fire('change', { dataset: {}, closest: () => null }); // unrelated element ignored
  assert.equal(calls.length, 4);
  const un = bindOwners(R, doc, hooks);
  un();
  fire('click', { closest: () => ({}) });
  assert.equal(calls.length, 4);
});

test('people: cards are collapsible and closed by default; opened ones stay open on re-render', async () => {
  const { renderPeople } = await import('../src/render/people.js');
  const ctx = fixture();
  const R = createEnv(ctx, createEngine(ctx), { ...baseState, devs: { BE: [], FE: [] } });
  const closed = renderPeople(R);
  assert.ok(/<details class="person" data-pk="BE:0">/.test(closed) && !/<details class="person"[^>]* open/.test(closed));
  assert.ok(/<summary class="person-h">/.test(closed));
  const open = renderPeople(R, new Set(['BE:0']));
  assert.ok(/<details class="person" data-pk="BE:0" open>/.test(open));
});
