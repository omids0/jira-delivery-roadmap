// Flow board behaviour inside the overlay iframe: chip selection, dependency wires
// and the story filter form. The iframe document is rewritten with document.write on
// every repaint, which drops all listeners, so everything is delegated from `doc`
// itself and bindFlow() is called again after each repaint.
import { chainOf, normKey } from '../render/flow.js';

export { chainOf, normKey };

const HINT = 'کارتی را انتخاب کنید.';
const holders = new WeakMap(); // documentElement -> { opts } (a repaint creates a new documentElement)

/** Text/HTML of the #sel-info line for the selected story. Pure. */
export function selInfoHtml(R, k, s, up, down) {
  const { esc, fa, kb } = R;
  const info = (R.DEP_INFO && R.DEP_INFO[k]) || {};
  const verdict = { ready: '✅ آماده', blocked: '⛔ مسدود' }[info.v] || '';
  const extra = [
    info.n ? `<div class="si-note">${esc(info.n)}</div>` : '',
    (info.x || []).length ? `<div class="si-ext">⛔ وابستگی بیرونی بدون استوری: ${info.x.map(esc).join('؛ ')}</div>` : '',
    (info.d || []).length ? `<div class="si-dec"><b>تصمیم‌های باز:</b><ul>${info.d.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>` : '',
    (info.soft || []).length ? `<div class="si-note">وابستگی نرم (خط‌چین): ${info.soft.map((x) => kb(x)).join('، ')}</div>` : ''
  ].join('');
  return `<div>${kb(k)} ${esc(s.title)} ${verdict ? `<span class="pill ${info.v === 'ready' ? 'good' : info.v === 'blocked' ? 'warn' : 'info'}">${verdict}</span>` : ''} — پیش‌نیاز: <b>${fa(up.size)}</b> کار · کارهای وابسته: <b>${fa(down.size)}</b> کار</div>${extra}`;
}

/**
 * svg markup of the wires of one selection. `pos(key)` -> { l, r, y } | null (box of the card in
 * flow coordinates). RTL: predecessor sits to the right, successor to the left. Pure.
 */
export function wirePaths(R, ctx, k, up, down, pos) {
  const { by } = ctx;
  const on = new Set([k, ...up, ...down]);
  const wire = (d, x, cls) => {
    const a = pos(d);
    const b = pos(x);
    if (!a || !b) return '';
    const x1 = a.l;
    const x2 = b.r;
    const mx = (x1 + x2) / 2;
    return `<path class="${cls || ''}" d="M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}"/><circle cx="${x2}" cy="${b.y}" r="3"/>`;
  };
  // blue: the path into the story (its prerequisites); green: the path out of it (stories that wait on it)
  const edgeCls = (d, x) => (down.has(x) && (down.has(d) || d === k) ? 'down' : up.has(d) && (up.has(x) || x === k) ? 'up' : '');
  let paths = '';
  on.forEach((x) => by[x].deps.forEach((d) => { if (on.has(d)) paths += wire(d, x, edgeCls(d, x)); }));
  const info = (R.DEP_INFO && R.DEP_INFO[k]) || {};
  (info.soft || []).forEach((d) => { if (by[d]) paths += wire(d, k, 'soft'); });
  return paths;
}

function currentCtx(doc, fctx) {
  if (fctx) return fctx;
  const h = holders.get(doc.documentElement);
  return h ? h.opts.getFlowCtx() : null;
}

function clearSelection(doc) {
  const flow = doc.getElementById('flow');
  if (flow) {
    flow.dataset.sel = '';
    flow.classList.remove('has-sel');
    flow.querySelectorAll('.chip').forEach((c) => c.classList.remove('on', 'self', 'dn'));
    flow.querySelectorAll('.mini').forEach((c) => c.classList.remove('on'));
  }
  const svg = doc.getElementById('wires');
  if (svg) svg.innerHTML = '';
  const info = doc.getElementById('sel-info');
  if (info) info.textContent = HINT;
}

/**
 * Highlight the dependency chain of story `k`, draw its wires into #wires and describe it in #sel-info.
 * `fctx` is the ctx returned by renderFlow (defaults to the one given to bindFlow).
 */
export function drawWires(R, doc, k, fctx) {
  const ctx = currentCtx(doc, fctx);
  const flow = doc.getElementById('flow');
  const svg = doc.getElementById('wires');
  if (!ctx || !flow || !svg || !ctx.by[k]) return;
  const { by, succ } = ctx;
  flow.dataset.sel = k;
  const { up, down } = chainOf(k, by, succ);
  const on = new Set([k, ...up, ...down]);
  flow.classList.add('has-sel');
  flow.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('on', on.has(c.dataset.k));
    c.classList.toggle('self', c.dataset.k === k);
    c.classList.toggle('dn', down.has(c.dataset.k));
  });
  flow.querySelectorAll('.mini').forEach((c) => c.classList.toggle('on', on.has(c.dataset.k)));
  const fr = flow.getBoundingClientRect();
  const pos = (x) => {
    const el = [...flow.querySelectorAll('[data-k]')].find((n) => n.dataset.k === x);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left - fr.left, r: r.right - fr.left, y: r.top - fr.top + r.height / 2 };
  };
  svg.setAttribute('viewBox', `0 0 ${fr.width} ${fr.height}`);
  svg.innerHTML = wirePaths(R, ctx, k, up, down, pos);
  const info = doc.getElementById('sel-info');
  if (info) info.innerHTML = selInfoHtml(R, k, by[k], up, down);
}

/** Toggle the selection of a chip: select `k`, or clear when it is already selected (unless `force`). */
export function selectChip(R, doc, k, force, fctx) {
  const flow = doc.getElementById('flow');
  const ctx = currentCtx(doc, fctx);
  if (!flow || !ctx) return;
  if (!k || !ctx.by[k] || (!force && flow.dataset.sel === k)) { clearSelection(doc); return; }
  drawWires(R, doc, k, ctx);
}

function setStatus(doc, text, err) {
  const fs = doc.getElementById('flow-q-status');
  if (!fs) return;
  fs.className = err ? 'fq-status err' : 'fq-status';
  fs.textContent = text;
}

function applyFlowQuery(R, doc, opts, v) {
  const k = normKey(v, R.META.project);
  const ctx = opts.getFlowCtx();
  if (!k) opts.setFlowQuery(null);
  else if (!ctx || !ctx.by[k]) {
    setStatus(doc, `استوری ${k} در این نقشه نیست. شاید با فیلترهای بالای صفحه پنهان شده باشد.`, true);
    return;
  } else opts.setFlowQuery(k);
  opts.rerender();
}

/** State of a freshly painted board: nothing selected, status line, filter box, and the chain of an active filter. */
function afterPaint(R, doc, opts) {
  const ctx = opts.getFlowCtx();
  if (!ctx) return;
  clearSelection(doc);
  setStatus(doc, ctx.status || '', false);
  const q = doc.getElementById('flow-q');
  if (q && ctx.query) q.value = ctx.query;
  if (ctx.query) {
    const win = doc.defaultView;
    const raf = win && typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win) : (f) => setTimeout(f, 0);
    // draw the chain once the board is laid out
    raf(() => selectChip(R, doc, ctx.query, true, opts.getFlowCtx()));
  }
}

/**
 * Attach the flow board behaviour to `doc` (call after every repaint of the document).
 * @param {object} R
 * @param {Document} doc
 * @param {{ getP: () => object, getFlowCtx: () => object|null, getFlowQuery: () => string|null,
 *           setFlowQuery: (k: string|null) => void, rerender: () => void }} opts
 *   rerender must repaint the flow board (and then call bindFlow again if the document is rewritten).
 */
export function bindFlow(R, doc, opts) {
  const root = doc.documentElement;
  const existing = holders.get(root);
  if (existing) { // same document repainted in place: listeners are still there
    existing.opts = opts;
    afterPaint(R, doc, opts);
    return;
  }
  const holder = { opts };
  holders.set(root, holder);
  const closest = (e, sel) => (e.target && e.target.closest ? e.target.closest(sel) : null);

  doc.addEventListener('click', (e) => {
    const flow = doc.getElementById('flow');
    const chip = closest(e, '.chip');
    if (chip && flow && flow.contains(chip)) { selectChip(R, doc, chip.dataset.k, false, holder.opts.getFlowCtx()); return; }
    if (closest(e, '#flow-clear')) {
      const q = doc.getElementById('flow-q');
      if (q) q.value = '';
      applyFlowQuery(R, doc, holder.opts, '');
    }
  });
  doc.addEventListener('submit', (e) => {
    if (!closest(e, '#flow-filter') && !(e.target && e.target.id === 'flow-filter')) return;
    e.preventDefault();
    const q = doc.getElementById('flow-q');
    applyFlowQuery(R, doc, holder.opts, q ? q.value : '');
  });
  doc.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.id === 'flow-q' && !String(t.value).trim() && holder.opts.getFlowQuery()) applyFlowQuery(R, doc, holder.opts, '');
  });
  // wires are measured in pixels: redraw after a resize
  const win = doc.defaultView;
  if (win && win.addEventListener) {
    win.addEventListener('resize', () => {
      const flow = doc.getElementById('flow');
      const k = flow && flow.dataset.sel;
      if (k) selectChip(R, doc, k, true, holder.opts.getFlowCtx());
    });
  }
  afterPaint(R, doc, opts);
}
