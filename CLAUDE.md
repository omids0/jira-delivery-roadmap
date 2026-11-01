# jira-delivery-roadmap

Persian-language (RTL) bookmarklet app: delivery roadmap for any Jira Data Center project. Runs INSIDE the Jira page with the user's session cookie (same-origin `fetch`, no token, no server). Sister project: `../jira-status-dashboard` (same bookmarklet/overlay pattern; reuse its ideas, do not import from it).

## Read first
- `docs/DESIGN.md`: goal, target features, scheduling rules, architecture, next steps, open risks.
- `README.md`: user-facing install + config docs.

## State
Done: bookmarklet → overlay → project select → team settings form (localStorage) → data model (`src/collect.js` fetch, `src/model.js` pure normalize + `summarize`) → overview with epic table and data-quality notes. NOT written yet: velocity from sprints, scheduler/critical path, timeline/flow/sprint renderers.

## Rules
- **Public repo, public GitHub Pages. Never commit company data** (project keys, epic/story titles, people names, Jira URLs). `reference/` is gitignored and holds a local-only company artifact (`reference/original-artifact.html`) used as the behavioral spec; read it, never copy its data into tracked files.
- No project data hardcoded in code. Per-project differences go in `config/projects.json` (`defaults` + `projects.<KEY>`).
- Scheduler/model code = pure functions, no DOM, unit-tested with `node --test` (JSON fixtures must be synthetic).
- Rendering = pure string builders in `src/render/`, escape everything via `esc()`.
- `npm test` and `npm run build:site` must pass before push; every push to `main` deploys Pages.
- User-facing text in Persian; code, comments, commits in English.
