// Tooltip over the gantt bars. The overlay iframe document is rewritten on every
// repaint, so listeners hang on `doc` itself (delegation) and bindTooltips() is
// called again after each repaint.

const holders = new WeakMap(); // documentElement -> { opts }

/** HTML of the tooltip for one scheduled item v = { t: { role, subs, dur, s }, s, e }. Pure. */
export function tipHtml(R, v) {
  const { esc, fa, fmtD, dateAt, endDate, EP } = R;
  const s = v.t.s;
  const ep = EP[s.ep] || EP.oth || { n: '', k: null };
  const deps = s.deps.length ? s.deps.map((d) => `<span class="k">${esc(d)}</span>`).join('، ') : 'ندارد';
  return `<div class="k">${esc(s.k)} · ${v.t.role === 'BE' ? 'بک‌اند' : 'فرانت'}</div><b>${esc(s.title)}</b><br>اپیک: <b>${esc(ep.n)}</b>${ep.k ? ` <span class="k">${esc(ep.k)}</span>` : ''}<br>${fmtD.format(dateAt(v.s))} تا ${fmtD.format(endDate(v.e))} · ${fa(v.t.subs)} sub-task ≈ ${fa(v.t.dur, 2)} روز<br>پیش‌نیاز: ${deps}${s.f.includes('d') ? '<br>منتظر تصمیم PO' : ''}${s.f.includes('x') ? '<br>پیشنهادی، در Jira نیست' : ''}`;
}

function tipEl(doc) {
  let tip = doc.getElementById('tip');
  if (!tip) {
    tip = doc.createElement('div');
    tip.id = 'tip';
    tip.hidden = true;
    (doc.body || doc.documentElement).appendChild(tip);
  }
  return tip;
}

function showTip(doc, html, x, y) {
  const tip = tipEl(doc);
  const win = doc.defaultView || {};
  const W = win.innerWidth || 1000;
  const H = win.innerHeight || 800;
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let left = x - r.width - 14;
  if (left < 8) left = x + 14;
  let top = y + 14;
  if (top + r.height > H - 8) top = y - r.height - 10;
  tip.style.left = Math.max(8, Math.min(W - r.width - 8, left)) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}

function lookup(index, id) {
  if (!index) return undefined;
  return index instanceof Map ? index.get(id) : index[id];
}

/**
 * @param {object} R
 * @param {Document} doc
 * @param {{ getGanttIndex: () => (Map|object) }} opts  bar.dataset.id -> scheduled item v = { t: { s, role, subs, dur }, s, e }
 */
export function bindTooltips(R, doc, opts) {
  const root = doc.documentElement;
  const existing = holders.get(root);
  if (existing) { existing.opts = opts; return; }
  const holder = { opts };
  holders.set(root, holder);
  const hide = () => { const t = doc.getElementById('tip'); if (t) t.hidden = true; };

  doc.addEventListener('pointermove', (e) => {
    const bar = e.target && e.target.closest ? e.target.closest('.bar') : null;
    if (!bar) { hide(); return; }
    const v = lookup(holder.opts.getGanttIndex(), bar.dataset.id);
    if (!v) return;
    showTip(doc, tipHtml(R, v), e.clientX, e.clientY);
  });
  doc.addEventListener('scroll', hide, true);
  root.addEventListener('mouseleave', hide);
}
