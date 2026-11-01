// UI state of one roadmap (team size, pace scenario, toggles, epic owners).
// Saved per Jira host + project in localStorage. Pure apart from the storage argument.

export const stateKey = (host, project) => `jira-roadmap:state:${host}:${project}`;

const KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
const PACES = ['avg', 'opt', 'pes', 'wl']; // wl = pace from worklogs
const clamp = (n, lo, hi, fallback) => {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

/** Epic owners are kept by Jira epic key; anything else is dropped. */
export function normOwn(o) {
  const out = { BE: {}, FE: {} };
  for (const r of ['BE', 'FE']) {
    for (const [k, v] of Object.entries((o && o[r]) || {})) if (KEY_RE.test(k) && Number.isInteger(v) && v >= 0) out[r][k] = v;
  }
  return out;
}

const intIn = (v, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/** Settings of the proposed sprint; null = use the board's default. reserve = percent of capacity kept for bugs and other work. */
export function normSprint(s) {
  const start = typeof s?.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.start) && !Number.isNaN(Date.parse(s.start)) ? s.start : null;
  return {
    start, basis: ['wl', 'velocity'].includes(s?.basis) ? s.basis : null, len: intIn(s?.len, 1, 30), n: intIn(s?.n, 1, 9999), target: intIn(s?.target, 1, 500),
    be: intIn(s?.be, 1, 6), fe: intIn(s?.fe, 1, 6), reserve: intIn(s?.reserve, 0, 80) || 0
  };
}

/** Per-person settings: { BE: [{ name, pace, par }], FE: [...] }; name = chosen team member, pace = sub-tasks per workday (null: scenario pace), par = stories at once (null: default). */
export function normDevs(d) {
  const out = { BE: [], FE: [] };
  for (const r of ['BE', 'FE']) {
    const list = Array.isArray(d?.[r]) ? d[r].slice(0, 6) : [];
    out[r] = list.map((x) => {
      const pace = Number(x?.pace);
      return {
        par: intIn(x?.par, 1, 6),
        name: typeof x?.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 60) : null,
        pace: x?.pace != null && Number.isFinite(pace) && pace >= 0.5 && pace <= 200 ? Math.round(pace * 10) / 10 : null
      };
    });
  }
  return out;
}

/** @param {object} cfg merged project config (team, parallelStories) */
export function defaultState(cfg) {
  return {
    be: clamp(cfg.team?.be, 1, 6, 1), fe: clamp(cfg.team?.fe, 1, 6, 1), par: clamp(cfg.parallelStories, 1, 6, 3),
    pace: 'avg', p2: true, p3: true, def: false, hist: true, own: { BE: {}, FE: {} }, devs: { BE: [], FE: [] }, sprint: normSprint({})
  };
}

export function normalizeState(raw, base) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    be: clamp(r.be, 1, 6, base.be), fe: clamp(r.fe, 1, 6, base.fe), par: clamp(r.par, 1, 6, base.par),
    pace: PACES.includes(r.pace) ? r.pace : base.pace,
    p2: typeof r.p2 === 'boolean' ? r.p2 : base.p2, p3: typeof r.p3 === 'boolean' ? r.p3 : base.p3,
    def: typeof r.def === 'boolean' ? r.def : base.def, hist: typeof r.hist === 'boolean' ? r.hist : base.hist,
    own: normOwn(r.own),
    devs: normDevs(r.devs),
    sprint: normSprint(r.sprint)
  };
}

export function loadState(storage, key, cfg) {
  const base = defaultState(cfg);
  try {
    return normalizeState(JSON.parse(storage.getItem(key)), base);
  } catch {
    return base;
  }
}

export function saveState(storage, key, state) {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // private mode or full storage: the choice lasts until the overlay closes
  }
}
