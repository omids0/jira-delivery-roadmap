// Per-user, per-project settings chosen in the overlay (team size, component
// names). Stored in localStorage on top of the defaults from config/projects.json.

const int = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const str = (v, fallback) => String(v ?? '').trim().slice(0, 60) || fallback;

/** Clamps and trims raw input; anything missing or invalid falls back to `base`. */
/** "CODE=Name" lines or an object -> { CODE: Name } (codes: letters, digits, _ and -). */
export function parseModuleLabels(input) {
  const out = {};
  const pairs = typeof input === 'string'
    ? input.split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2))
    : Object.entries(input && typeof input === 'object' ? input : {});
  for (const [k, v] of pairs) {
    const key = String(k ?? '').trim();
    const val = String(v ?? '').trim().slice(0, 60);
    if (/^[A-Za-z0-9_-]{1,40}$/.test(key) && val && Object.keys(out).length < 100) out[key] = val;
  }
  return out;
}

export function normalizeSettings(raw, base) {
  const r = raw ?? {};
  return {
    team: {
      be: int(r.team?.be, 1, 20, base.team?.be ?? 1),
      fe: int(r.team?.fe, 1, 20, base.team?.fe ?? 1)
    },
    parallelStories: int(r.parallelStories, 1, 10, base.parallelStories ?? 3),
    moduleLabels: r.moduleLabels === undefined ? parseModuleLabels(base.moduleLabels) : parseModuleLabels(r.moduleLabels),
    components: {
      be: str(r.components?.be, base.components?.be ?? 'Back-End'),
      fe: str(r.components?.fe, base.components?.fe ?? 'Front-End')
    }
  };
}

export const settingsKey = (host, project) => `jira-roadmap:settings:${host}:${project}`;

/** Saved settings of one project (or the defaults), merged over `base`. */
export function loadSettings(storage, key, base) {
  let raw = null;
  try {
    raw = JSON.parse(storage.getItem(key));
  } catch {
    // unreadable or missing: use defaults
  }
  return normalizeSettings(raw, base);
}

export function saveSettings(storage, key, settings) {
  try {
    storage.setItem(key, JSON.stringify(settings));
    return true;
  } catch {
    return false; // private mode or full storage: the choice only lasts until the overlay closes
  }
}
