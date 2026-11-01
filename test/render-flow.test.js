import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, baseState } from '../test-support/fixture.js';
import { createEngine } from '../src/engine.js';
import { createEnv } from '../src/render/env.js';
import { renderFlow, chainOf, normKey } from '../src/render/flow.js';
import { bindFlow, drawWires, selectChip, selInfoHtml } from '../src/browser/flow-ui.js';
import { bindTooltips, tipHtml } from '../src/browser/tooltip.js';

function setup(over = {}) {
  const ctx = fixture();
  const state = { ...baseState, own: { BE: {}, FE: {} }, ...over };
  const eng = createEngine(ctx);
  const R = createEnv(ctx, eng, state);
  const P = eng.plan(state);
  const crit = new Set([...eng.criticalChain(P.sched)].map((id) => id.split(':')[0]));
  return { ctx, state, eng, R, P, crit };
}

const clean = (h) => {
  assert.ok(h.length > 0);
  assert.ok(!/undefined|NaN|\[object/.test(h), 'no undefined/NaN in output');
};

test('normKey', () => {
  assert.equal(normKey(' p-12 ', 'P'), 'P-12');
  assert.equal(normKey('12', 'P'), 'P-12');
  assert.equal(normKey('12', ''), '12');
  assert.equal(normKey('p - 3', 'P'), 'P-3');
  assert.equal(normKey(null, 'P'), '');
});

test('chainOf walks up and down transitively', () => {
  const { P } = setup();
  const by = Object.fromEntries(P.list.map((s) => [s.k, s]));
  const succ = {};
  P.list.forEach((s) => s.deps.forEach((d) => (succ[d] = succ[d] || []).push(s.k)));
  const { up, down } = chainOf('P-2', by, succ);
  assert.deepEqual([...up], ['P-1']);
  assert.deepEqual([...down], ['P-3']);
  const c3 = chainOf('P-3', by, succ);
  assert.deepEqual([...c3.up].sort(), ['P-1', 'P-2']);
  assert.equal(c3.down.size, 0);
});

test('renderFlow: board structure', () => {
  const { R, P, crit } = setup();
  const { html, ctx } = renderFlow(R, P, crit, null);
  clean(html);
  assert.match(html, /<svg class="wires" id="wires"/);
  assert.match(html, /f-row f-head/);
  for (const k of ['P-1', 'P-2', 'P-3', 'P-4']) assert.match(html, new RegExp(`class="chip[^"]*" data-k="${k}"`));
  assert.match(html, /class="chip[^"]*crit/);
  assert.match(html, /گام ۱/);
  assert.match(html, /گام ۳/); // P-1 -> P-2 -> P-3
  assert.match(html, /class="mini" data-k="P-5"/); // old Done story in the history column
  assert.deepEqual(Object.keys(ctx.by).sort(), ['P-1', 'P-2', 'P-3', 'P-4', 'P-5']);
  assert.deepEqual(ctx.succ['P-1'], ['P-2']);
  assert.equal(ctx.query, null);
  assert.equal(ctx.status, '');
});

test('renderFlow: history column follows state.hist', () => {
  const { R, P, crit } = setup({ hist: false });
  const { html } = renderFlow(R, P, crit, null);
  assert.ok(!html.includes('انجام‌شده'));
  assert.ok(!html.includes('data-k="P-5"'));
});

test('renderFlow: query keeps only the dependency chain', () => {
  const { R, P, crit } = setup({ hist: false });
  const { html, ctx } = renderFlow(R, P, crit, 'P-2');
  clean(html);
  assert.equal(ctx.query, 'P-2');
  assert.match(ctx.status, /۱ پیش‌نیاز و ۱ استوری وابسته/);
  assert.ok(ctx.status.startsWith('P-2:'));
  for (const k of ['P-1', 'P-2', 'P-3']) assert.match(html, new RegExp(`data-k="${k}"`));
  assert.ok(!html.includes('data-k="P-4"'));
});

test('renderFlow: unknown query is dropped', () => {
  const { R, P, crit } = setup();
  const { ctx, html } = renderFlow(R, P, crit, 'P-999');
  assert.equal(ctx.query, null);
  assert.match(html, /data-k="P-4"/);
});

test('renderFlow: titles and epic names are escaped', () => {
  const { ctx, R, P, crit } = setup();
  ctx.EP.e1.n = '<img src=x onerror=1>';
  P.list.find((s) => s.k === 'P-1').title = '<script>alert("x")</script>';
  const { html } = renderFlow(R, P, crit, null);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x/);
});

test('renderFlow survives a dependency cycle and an empty plan', () => {
  const { R, P, crit } = setup();
  P.list.find((s) => s.k === 'P-1').deps.push('P-3');
  clean(renderFlow(R, P, crit, null).html);
  clean(renderFlow(R, { ...P, list: [] }, new Set(), null).html);
});

// ---- minimal fake DOM ----
function fakeEl(props = {}) {
  const cls = new Set(props.cls || []);
  return {
    id: props.id || '', dataset: props.dataset || {}, value: props.value || '', className: '', textContent: '', innerHTML: '', hidden: false,
    attrs: {}, children: props.children || [], style: {},
    classList: {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
      contains: (c) => cls.has(c)
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getBoundingClientRect: () => props.rect || { left: 0, right: 0, top: 0, height: 0, width: 0 },
    contains(n) { return n === this || this.children.includes(n); },
    querySelectorAll(sel) {
      if (sel === '[data-k]') return this.children;
      const c = sel.slice(1);
      return this.children.filter((x) => x.classList.contains(c));
    },
    closest(sel) { return props.closest ? props.closest(sel, this) : null; }
  };
}

function fakeDoc(R, P) {
  const chips = P.list.filter((s) => !s.hist).map((s, i) => {
    const el = fakeEl({ cls: ['chip'], dataset: { k: s.k }, rect: { left: 10 + i * 5, right: 60 + i * 5, top: 20 * i, height: 10, width: 50 } });
    el.closest = (sel) => (sel === '.chip' ? el : null);
    return el;
  });
  const els = {
    flow: fakeEl({ id: 'flow', children: chips, rect: { left: 0, right: 500, top: 0, height: 300, width: 500 } }),
    wires: fakeEl({ id: 'wires' }), 'sel-info': fakeEl({ id: 'sel-info' }), 'flow-q-status': fakeEl({ id: 'flow-q-status' }),
    'flow-q': fakeEl({ id: 'flow-q' }), 'flow-filter': fakeEl({ id: 'flow-filter' }), 'flow-clear': fakeEl({ id: 'flow-clear' })
  };
  els['flow-filter'].closest = (sel) => (sel === '#flow-filter' ? els['flow-filter'] : null);
  els['flow-clear'].closest = (sel) => (sel === '#flow-clear' ? els['flow-clear'] : null);
  const listeners = {};
  const doc = {
    documentElement: { addEventListener() {} },
    defaultView: { addEventListener() {}, requestAnimationFrame: (f) => f() },
    getElementById: (id) => els[id] || null,
    addEventListener: (t, f) => (listeners[t] = listeners[t] || []).push(f),
    fire: (t, e) => (listeners[t] || []).forEach((f) => f(e))
  };
  return { doc, els, chips };
}

test('bindFlow: chip click selects, draws wires, second click clears', () => {
  const { R, P, crit } = setup();
  const { ctx } = renderFlow(R, P, crit, null);
  const { doc, els, chips } = fakeDoc(R, P);
  bindFlow(R, doc, { getP: () => P, getFlowCtx: () => ctx, getFlowQuery: () => null, setFlowQuery() {}, rerender() {} });
  assert.equal(els['sel-info'].textContent, 'کارتی را انتخاب کنید.');
  const chip = chips.find((c) => c.dataset.k === 'P-2');
  doc.fire('click', { target: chip });
  assert.equal(els.flow.dataset.sel, 'P-2');
  assert.ok(els.flow.classList.contains('has-sel'));
  assert.ok(chip.classList.contains('self'));
  assert.ok(chips.find((c) => c.dataset.k === 'P-1').classList.contains('on'));
  assert.ok(chips.find((c) => c.dataset.k === 'P-3').classList.contains('dn'));
  assert.ok(!chips.find((c) => c.dataset.k === 'P-4').classList.contains('on'));
  assert.match(els.wires.innerHTML, /<path class="up"/);
  assert.match(els.wires.innerHTML, /<path class="down"/);
  assert.equal(els.wires.attrs.viewBox, '0 0 500 300');
  clean(els['sel-info'].innerHTML);
  assert.match(els['sel-info'].innerHTML, /پیش‌نیاز: <b>۱<\/b> کار/);
  doc.fire('click', { target: chip });
  assert.equal(els.flow.dataset.sel, '');
  assert.equal(els.wires.innerHTML, '');
  assert.equal(els['sel-info'].textContent, 'کارتی را انتخاب کنید.');
  assert.ok(!els.flow.classList.contains('has-sel'));
  drawWires(R, doc, 'P-3', ctx);
  assert.equal(els.flow.dataset.sel, 'P-3');
  selectChip(R, doc, null, false, ctx);
  assert.equal(els.flow.dataset.sel, '');
});

test('bindFlow: filter form', () => {
  const { R, P, crit } = setup();
  const { ctx } = renderFlow(R, P, crit, null);
  const { doc, els } = fakeDoc(R, P);
  let q = null;
  let reruns = 0;
  const opts = { getP: () => P, getFlowCtx: () => ctx, getFlowQuery: () => q, setFlowQuery: (k) => { q = k; }, rerender: () => { reruns++; } };
  bindFlow(R, doc, opts);
  let prevented = 0;
  els['flow-q'].value = '3';
  doc.fire('submit', { target: els['flow-filter'], preventDefault: () => prevented++ });
  assert.equal(prevented, 1);
  assert.equal(q, 'P-3');
  assert.equal(reruns, 1);
  els['flow-q'].value = '999';
  doc.fire('submit', { target: els['flow-filter'], preventDefault() {} });
  assert.equal(q, 'P-3');
  assert.equal(reruns, 1);
  assert.equal(els['flow-q-status'].className, 'fq-status err');
  assert.match(els['flow-q-status'].textContent, /P-999/);
  // emptying the box clears the filter
  els['flow-q'].value = '  ';
  doc.fire('input', { target: els['flow-q'] });
  assert.equal(q, null);
  assert.equal(reruns, 2);
  // the clear button
  q = 'P-3';
  els['flow-q'].value = 'P-3';
  doc.fire('click', { target: els['flow-clear'] });
  assert.equal(q, null);
  assert.equal(els['flow-q'].value, '');
  assert.equal(reruns, 3);
});

test('bindFlow: active filter is restored after a repaint and its chain is drawn', () => {
  const { R, P, crit } = setup();
  const { ctx } = renderFlow(R, P, crit, 'P-2');
  const { doc, els } = fakeDoc(R, P);
  bindFlow(R, doc, { getP: () => P, getFlowCtx: () => ctx, getFlowQuery: () => 'P-2', setFlowQuery() {}, rerender() {} });
  assert.equal(els['flow-q'].value, 'P-2');
  assert.equal(els['flow-q-status'].textContent, ctx.status);
  assert.equal(els.flow.dataset.sel, 'P-2');
});

test('selInfoHtml: verdict, decisions and external blockers are escaped', () => {
  const { R, P } = setup();
  R.DEP_INFO['P-2'] = { v: 'blocked', d: ['<b>d</b>'], x: ['EXT-1'], n: '<i>n</i>', soft: [] };
  const s = P.list.find((s) => s.k === 'P-2');
  const h = selInfoHtml(R, 'P-2', s, new Set(['P-1']), new Set());
  clean(h);
  assert.match(h, /pill warn/);
  assert.match(h, /&lt;b&gt;d&lt;\/b&gt;/);
  assert.match(h, /EXT-1/);
  assert.match(h, /&lt;i&gt;n&lt;\/i&gt;/);
  R.DEP_INFO['P-2'] = { v: 'ready', d: [], x: [], n: null, soft: [] };
  assert.match(selInfoHtml(R, 'P-2', s, new Set(), new Set()), /pill good/);
});

test('tipHtml and bindTooltips', () => {
  const { R, P } = setup();
  const v = [...P.sched.values()].find((x) => x.t.s.k === 'P-2');
  P.list.find((s) => s.k === 'P-2').title = '<b>x</b>';
  const h = tipHtml(R, v);
  clean(h);
  assert.match(h, /P-2/);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(h, /P-1/); // prerequisite

  const tip = fakeEl({ id: 'tip', rect: { width: 100, height: 40 } });
  tip.hidden = true;
  const listeners = {};
  const doc = {
    documentElement: { addEventListener() {} },
    defaultView: { innerWidth: 800, innerHeight: 600 },
    getElementById: (id) => (id === 'tip' ? tip : null),
    addEventListener: (t, f) => (listeners[t] = listeners[t] || []).push(f)
  };
  const index = new Map([['P-2:BE', v]]);
  bindTooltips(R, doc, { getGanttIndex: () => index });
  const bar = { dataset: { id: 'P-2:BE' } };
  listeners.pointermove[0]({ target: { closest: () => bar }, clientX: 400, clientY: 100 });
  assert.equal(tip.hidden, false);
  assert.match(tip.innerHTML, /P-2/);
  assert.equal(tip.style.left, '286px');
  assert.equal(tip.style.top, '114px');
  listeners.pointermove[0]({ target: { closest: () => null }, clientX: 1, clientY: 1 });
  assert.equal(tip.hidden, true);
  // plain objects work as the index too
  bindTooltips(R, doc, { getGanttIndex: () => ({ 'P-2:BE': v }) });
  listeners.pointermove[0]({ target: { closest: () => bar }, clientX: 5, clientY: 5 });
  assert.equal(tip.hidden, false);
});
