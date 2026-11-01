// Per-project settings: config/projects.json holds `defaults` for every project
// and `projects.<KEY>` overrides. Plain objects merge key by key, everything
// else (arrays, numbers, strings) is replaced.

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isPlain(v) && isPlain(base[k]) ? merge(base[k], v) : v;
  return out;
}

/** @returns {(key: string) => object} settings for one project key */
export function makeProjectConfig(file) {
  const defaults = file?.defaults ?? {};
  const projects = file?.projects ?? {};
  return (key) => merge(defaults, projects[key] ?? {});
}
