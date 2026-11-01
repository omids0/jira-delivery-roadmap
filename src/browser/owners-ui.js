// Interaction for the epic ownership table. Listeners sit on the iframe document itself
// (event delegation), because the page body is rewritten on every repaint.
// Call bindOwners again after each repaint: it is idempotent (it drops its previous
// listeners first), which also covers browsers that clear listeners on document.open().

const bound = new WeakMap();

/**
 * @param {object} R  render environment
 * @param {Document} doc  the iframe document
 * @param {{ getP: () => object, setOwn: (own: {BE: object, FE: object}) => void, rerender: () => void }} hooks
 *   getP: latest plan result; setOwn: persist (and store into R.state.own) the new choices; rerender: repaint
 * @returns {() => void} unbind
 */
export function bindOwners(R, doc, { getP, setOwn, rerender }) {
  if (bound.has(doc)) bound.get(doc)();

  const onChange = (e) => {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.r || !el.closest || !el.closest('#own-tbl')) return;
    const r = el.dataset.r;
    const key = (R.EP[el.dataset.ep] || {}).k;
    if (!key) return;
    // pin the current split of this role so changing one epic does not reshuffle the others
    const P = getP();
    const pinned = {};
    Object.entries((P && P.owners && P.owners.own[r]) || {}).forEach(([code, i]) => {
      const k = (R.EP[code] || {}).k;
      if (k) pinned[k] = i;
    });
    const cur = R.state.own || { BE: {}, FE: {} };
    const next = { BE: { ...cur.BE }, FE: { ...cur.FE } };
    next[r] = { ...cur[r], ...pinned, [key]: Number(el.value) };
    setOwn(next);
    rerender();
  };

  const onClick = (e) => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('#own-auto')) return;
    setOwn({ BE: {}, FE: {} });
    rerender();
  };

  doc.addEventListener('change', onChange);
  doc.addEventListener('click', onClick);
  const unbind = () => {
    doc.removeEventListener('change', onChange);
    doc.removeEventListener('click', onClick);
    bound.delete(doc);
  };
  bound.set(doc, unbind);
  return unbind;
}
