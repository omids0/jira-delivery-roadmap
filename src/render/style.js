// Stylesheet of the roadmap page (blueprint sheet: header + controls, KPI strip, overview, flow board,
// swimlane timeline, tables, sprint proposal). Tokens on :root, dark theme under prefers-color-scheme.
export const CSS = `/* Layout: blueprint sheet — header + team controls, KPI strip, dependency flow board (epic rows × step columns), swimlane timeline per developer, epic delivery table, notes */
:root {
  --bg: #f4f6f9; --surface: #ffffff; --sunk: #eceff4; --fg: #111522; --fg2: #474f62; --muted: #737b8f;
  --line: #d9dee7; --grid: #e6e9ef; --accent: #1d5bb8; --accent-soft: #e3ecfa;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300; --s7: #6250d6; --s8: #e34948; --s0: #8b91a1;
  --warn: #fab219; --crit: #d03b3b; --good: #0ca30c;
  --f-body: 'Vazirmatn', Tahoma, 'Segoe UI', sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
  --r: 8px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0e1117; --surface: #151a23; --sunk: #1b212c; --fg: #edf0f5; --fg2: #b3bac9; --muted: #868d9e;
    --line: #2a313e; --grid: #1f2530; --accent: #6ea4f2; --accent-soft: #1b2a44;
    --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; --s7: #9085e9; --s8: #e66767; --s0: #6c7282;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0e1117; --surface: #151a23; --sunk: #1b212c; --fg: #edf0f5; --fg2: #b3bac9; --muted: #868d9e;
  --line: #2a313e; --grid: #1f2530; --accent: #6ea4f2; --accent-soft: #1b2a44;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; --s7: #9085e9; --s8: #e66767; --s0: #6c7282;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--f-body); font-size: 14px; line-height: 1.7; }
.wrap { max-width: 1280px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; display: grid; gap: 28px; }
h1, h2, h3 { text-wrap: balance; margin: 0; line-height: 1.35; }
h1 { font-size: clamp(24px, 3.4vw, 34px); font-weight: 800; letter-spacing: -0.01em; }
h2 { font-size: 19px; font-weight: 800; }
p { margin: 0; }
.mono, bdi.k { font-family: var(--f-mono); font-size: 0.86em; font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 12px; color: var(--muted); font-weight: 500; letter-spacing: 0.02em; }
.lead { color: var(--fg2); max-width: 72ch; }
.num { font-variant-numeric: tabular-nums; }

/* header */
header.top { display: grid; gap: 10px; }
.sheet-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12.5px; color: var(--muted); }
.sheet-meta b { color: var(--fg2); font-weight: 700; }

/* controls */
.controls { display: flex; flex-wrap: wrap; gap: 12px 22px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 12px 16px; }
.stepper { display: flex; align-items: center; gap: 8px; }
.stepper .lbl { font-weight: 700; font-size: 13px; }
.stepper button { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--line); background: var(--sunk); color: var(--fg); font: inherit; font-size: 16px; cursor: pointer; line-height: 1; }
.stepper button:hover { border-color: var(--accent); }
.stepper button:focus-visible, .toggle input:focus-visible + span, .chip:focus-visible, .bar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.stepper output { min-width: 22px; text-align: center; font-weight: 800; font-size: 16px; }
.role-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.role-dot.be { background: var(--fg); }
.role-dot.fe { background: transparent; border: 2px solid var(--fg); }
.toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; user-select: none; }
.toggle input { accent-color: var(--accent); width: 16px; height: 16px; }
.controls .sep { width: 1px; align-self: stretch; background: var(--line); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; background: var(--sunk); }
.seg label { position: relative; cursor: pointer; }
.seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.seg span { display: block; padding: 4px 11px; font-size: 12.5px; color: var(--fg2); }
.seg label + label span { border-inline-start: 1px solid var(--line); }
.seg input:checked + span { background: var(--accent); color: var(--surface); font-weight: 700; }
.seg input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: -2px; }
.rate { display: flex; align-items: center; gap: 8px; min-width: 170px; }
.rate .track { flex: 1; height: 8px; background: var(--grid); border-radius: 4px; position: relative; overflow: hidden; }
.rate .track i { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 4px; background: var(--fg2); }
.rate .track i.fe { background: transparent; border: 1.5px solid var(--fg2); }
tr.sum td { background: var(--accent-soft); font-weight: 700; }
.refresh { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-inline-start: auto; }
.btn { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 7px; border: 1px solid var(--accent); background: var(--accent); color: var(--surface); cursor: pointer; }
.btn:hover { filter: brightness(1.08); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn[disabled] { opacity: .55; cursor: progress; }
.btn .ico { display: inline-block; font-size: 15px; line-height: 1; }
.btn.busy .ico { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(-360deg); } }
.r-status { font-size: 12.5px; color: var(--fg2); max-width: 46ch; }
.r-status.err { color: var(--crit); }
.r-status.ok { color: var(--good); }
@media (prefers-reduced-motion: reduce) { .btn.busy .ico { animation: none; } }

/* KPIs */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; }
.kpi { background: var(--surface); padding: 14px 16px; display: grid; gap: 2px; align-content: start; }
.kpi .v { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.2; }
.kpi .v small { font-size: 13px; font-weight: 500; color: var(--fg2); }
.kpi .l { font-size: 12.5px; color: var(--fg2); }
.kpi.hero .v { color: var(--accent); }
.whatif { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; color: var(--fg2); }
.whatif b { color: var(--fg); }

/* sections */
section.block { display: grid; gap: 14px; }
.block-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 8px 20px; }
.block-head .lead { font-size: 13.5px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--fg2); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.sw.hatch { background-image: repeating-linear-gradient(45deg, var(--s0) 0 2px, transparent 2px 5px); border: 1px solid var(--s0); }
.sw.crit { background: transparent; border: 2px solid var(--fg); }
.sw.gate { background: transparent; border: 1.5px dashed var(--fg2); }

/* flow board */
.flow-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r); background:
  radial-gradient(circle, var(--line) 1px, transparent 1.2px) 0 0 / 18px 18px, var(--surface); }
.flow { position: relative; display: grid; min-width: 1080px; }
.flow svg.wires { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.f-row { display: grid; border-bottom: 1px solid var(--line); }
.f-row:last-child { border-bottom: 0; }
.f-head { position: sticky; top: 0; z-index: 2; background: var(--sunk); border-bottom: 1px solid var(--line); }
.f-head > div { padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--fg2); }
.f-head > div small { display: block; font-weight: 400; color: var(--muted); }
.f-lab { padding: 10px 12px; display: grid; gap: 2px; align-content: start; border-inline-end: 1px solid var(--line); background: color-mix(in oklab, var(--surface) 85%, transparent); }
.f-lab .n { font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 7px; }
.f-lab .m { font-size: 11.5px; color: var(--muted); }
.f-cell { padding: 8px 6px; display: flex; flex-direction: column; gap: 6px; border-inline-end: 1px dashed var(--grid); min-width: 0; }
.f-cell:last-child { border-inline-end: 0; }
.chip { position: relative; display: grid; gap: 2px; text-align: start; background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-inline-start: 4px solid var(--c); border-radius: 6px; padding: 5px 8px 6px; font: inherit; font-size: 12px; line-height: 1.5; cursor: pointer; transition: opacity .15s, box-shadow .15s; }
.chip .t { font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.chip .meta { display: flex; justify-content: space-between; gap: 6px; color: var(--muted); font-size: 11px; }
.chip .roles { display: inline-flex; gap: 6px; align-items: center; }
.chip .roles i { font-style: normal; display: inline-flex; align-items: center; gap: 3px; }
.chip.sugg { background-image: repeating-linear-gradient(45deg, color-mix(in oklab, var(--s0) 18%, transparent) 0 2px, transparent 2px 7px); }
.chip.gate { border-style: dashed; border-inline-start-style: solid; }
.chip.crit { box-shadow: 0 0 0 2px var(--fg); }
.chip.ip::after { content: "در جریان"; position: absolute; top: -8px; inset-inline-end: 6px; font-size: 10px; padding: 0 6px; border-radius: 10px; background: var(--accent); color: var(--surface); line-height: 16px; }
.chip.done, .chip.rc { opacity: .55; background: var(--sunk); }
.chip.done .t { text-decoration: line-through; text-decoration-color: var(--muted); }
.chip.done::after, .chip.rc::after { position: absolute; top: -8px; inset-inline-end: 6px; font-size: 10px; padding: 0 6px; border-radius: 10px; background: var(--good); color: var(--surface); line-height: 16px; }
.chip.done::after { content: "✓ انجام شد"; }
.chip.rc::after { content: "آماده بستن"; }
.flow.has-sel .chip.done.on, .flow.has-sel .chip.rc.on { opacity: .7; }
.dpill { position: absolute; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 11px; font-family: var(--f-mono); font-size: 10.5px; font-weight: 700; color: var(--fg2); text-decoration: line-through; text-decoration-color: var(--muted); background: color-mix(in oklab, var(--c) 14%, var(--surface)); border: 1px solid color-mix(in oklab, var(--c) 45%, var(--surface)); opacity: .8; white-space: nowrap; }
.dpill.rc { text-decoration: none; border-style: dashed; }
.dpill:hover { opacity: 1; }
.done-ico { width: 18px; height: 18px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 11px; background: var(--good); color: var(--surface); }
.gate-line.today { border-inline-start: 2px solid var(--accent); }
.gate-line.today span { color: var(--accent); }
.f-cell.hist { flex-direction: row; flex-wrap: wrap; align-content: flex-start; gap: 4px; background: color-mix(in oklab, var(--sunk) 60%, transparent); }
.mini { font-family: var(--f-mono); font-size: 10.5px; line-height: 18px; padding-inline: 5px; border-radius: 4px; border-inline-start: 3px solid var(--c); background: var(--surface); color: var(--muted); text-decoration: line-through; text-decoration-color: var(--line); }
.mini:hover { color: var(--fg); text-decoration: none; }
/* project overview */
.ov-progress { display: grid; gap: 8px; }
.ov-progress .big { font-size: 15px; color: var(--fg2); }
.ov-progress .big b { font-size: 24px; color: var(--fg); font-weight: 800; }
.pbig { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--grid); }
.pbig i { display: block; height: 100%; }
.pbig i.d { background: var(--good); }
.pbig i.r { background: repeating-linear-gradient(45deg, var(--good) 0 3px, transparent 3px 6px); }
.pbig i.p { background: var(--accent); opacity: .35; }
.ov-stats { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 12.5px; color: var(--fg2); }
.ov-stats b { color: var(--fg); }
.ov { position: relative; }
.ov-row { display: flex; border-bottom: 1px solid var(--line); }
.ov-row:last-child { border-bottom: 0; }
.ov-lab { position: sticky; inset-inline-start: 0; z-index: 3; flex: 0 0 210px; width: 210px; padding: 6px 12px; background: var(--surface); border-inline-end: 1px solid var(--line); display: grid; gap: 3px; align-content: center; font-size: 12.5px; }
.ov-lab .n { font-weight: 700; display: flex; gap: 7px; align-items: center; }
.ov-lab .m { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.ov-lab .pb { flex: 1; height: 4px; background: var(--grid); border-radius: 2px; overflow: hidden; }
.ov-lab .pb i { display: block; height: 100%; background: var(--c); }
.ov-track { position: relative; flex: 0 0 auto; height: 42px; }
.ov-head, .ov-head .ov-lab { background: var(--sunk); }
.ov-head .ov-track { height: 40px; }
.ov-group .ov-lab { background: var(--sunk); font-size: 11.5px; font-weight: 800; color: var(--fg2); }
.ov-group .ov-track { height: 26px; }
.ov-hist .ov-track { height: 84px; }
.ov-dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: var(--c); margin-inline-start: -3px; box-shadow: 0 0 0 1px var(--surface); }
.ov-done { position: absolute; top: 19px; height: 4px; border-radius: 2px; background: var(--c); opacity: .45; }
.ov-plan { position: absolute; top: 13px; height: 16px; border-radius: 4px; border: 1px solid var(--c); background: repeating-linear-gradient(45deg, color-mix(in oklab, var(--c) 50%, transparent) 0 3px, color-mix(in oklab, var(--c) 14%, var(--surface)) 3px 7px); }
.ov-end { position: absolute; top: 12px; font-size: 11px; color: var(--fg2); white-space: nowrap; padding-inline-start: 6px; }
.ov-end.ok { color: var(--good); font-weight: 700; }
.ov-vl { position: absolute; inset-block: 0; pointer-events: none; z-index: 2; border-inline-start: 1px dashed var(--line); }
.ov-vl.today { border-inline-start: 2px solid var(--accent); }
.ov-vl span { position: absolute; top: 2px; inset-inline-start: 4px; font-size: 10.5px; white-space: nowrap; color: var(--muted); background: var(--sunk); padding: 0 4px; border-radius: 3px; }
.ov-vl.today span { color: var(--accent); font-weight: 700; }
.hb { position: absolute; bottom: 6px; border-radius: 2px 2px 0 0; background: var(--good); opacity: .85; }
.hb.plan { background: repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 5px); border: 1px solid var(--accent); border-bottom: 0; opacity: .8; }
.hb-max { position: absolute; top: 4px; inset-inline-start: 6px; font-size: 10.5px; color: var(--muted); }
.chip.ext { border-color: var(--crit); }
.chip.ext::after { content: "⛔ وابستگی بیرونی"; position: absolute; top: -8px; inset-inline-end: 6px; font-size: 10px; padding: 0 6px; border-radius: 10px; background: var(--crit); color: var(--surface); line-height: 16px; }
.flow.has-sel .mini { opacity: .25; }
.flow.has-sel .mini.on { opacity: 1; outline: 1.5px solid var(--accent); }
.wires path.soft { stroke-dasharray: 4 4; opacity: .6; }
.wires path.up { stroke: var(--accent); }
.wires path.down { stroke: var(--good); }
.flow.has-sel .chip.dn.on { box-shadow: 0 0 0 2px var(--good); }
.flow-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 13px; }
.flow-filter label { font-weight: 700; }
.flow-filter input { font: inherit; font-family: var(--f-mono); font-size: 13px; width: 150px; max-width: 100%; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--fg); }
.flow-filter input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.btn.ghost { background: transparent; color: var(--accent); }
.fq-legend { display: inline-flex; align-items: center; gap: 6px; color: var(--fg2); font-size: 12px; }
.fq-legend .ln { display: inline-block; width: 18px; height: 0; border-top: 2px solid var(--accent); }
.fq-legend .ln.down { border-top-color: var(--good); margin-inline-start: 8px; }
.fq-status { color: var(--fg2); font-size: 12.5px; }
.fq-status.err { color: var(--crit); }
.own { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); }
.own summary { padding: 10px 16px; cursor: pointer; font-weight: 800; font-size: 13.5px; }
.own-sum { font-weight: 400; color: var(--fg2); font-size: 12.5px; margin-inline-start: 10px; }
.own-body { display: grid; gap: 10px; padding: 0 16px 14px; }
.own select { font: inherit; font-size: 12.5px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg); }
.own select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.own small.auto { color: var(--muted); margin-inline-start: 6px; font-size: 11px; }
.own .muted { color: var(--muted); }
.people { display: grid; gap: 14px; }
.person { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); display: grid; min-width: 0; overflow: hidden; }
.person-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 10px 14px; background: var(--sunk); border-bottom: 1px solid var(--line); font-size: 12.5px; color: var(--fg2); }
.person-h .nm { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: var(--fg); }
.person-h b { color: var(--fg); }
.person table td .ep-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); margin-inline-end: 6px; }
.person table td.ttl { white-space: normal; min-width: 220px; }
.person table a { color: var(--accent); text-decoration: none; }
.person .empty { padding: 12px 14px; color: var(--muted); font-size: 13px; }
.sel-info { display: grid; gap: 4px; }
.sel-info .si-note { color: var(--muted); font-size: 12.5px; }
.sel-info .si-ext { color: var(--crit); font-size: 12.5px; }
.sel-info .si-dec { font-size: 12.5px; }
.sel-info .si-dec ul { margin: 2px 0 0; padding-inline-start: 18px; }
.chip.new::after { content: "جدید — برآورد پیش‌فرض"; position: absolute; top: -8px; inset-inline-end: 6px; font-size: 10px; padding: 0 6px; border-radius: 10px; background: var(--fg2); color: var(--surface); line-height: 16px; }
.flow.has-sel .chip { opacity: .22; }
.flow.has-sel .chip.on { opacity: 1; }
.flow.has-sel .chip.self { box-shadow: 0 0 0 2px var(--accent); }
.wires path { fill: none; stroke: var(--accent); stroke-width: 1.6; opacity: .85; }
.wires circle { fill: var(--accent); }
.sel-info { font-size: 13px; color: var(--fg2); min-height: 1.7em; }

/* gantt */
.gantt-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.gantt { position: relative; }
.g-row { display: flex; border-bottom: 1px solid var(--line); }
.g-row:last-child { border-bottom: 0; }
.g-lab { position: sticky; inset-inline-start: 0; z-index: 3; flex: 0 0 104px; width: 104px; padding: 8px 12px; background: var(--surface); border-inline-end: 1px solid var(--line); display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; }
.g-lab small { font-weight: 400; color: var(--muted); font-size: 11px; display: block; }
.g-track { position: relative; height: 46px; flex: 0 0 auto; }
.g-head .g-track { height: 44px; }
.g-head .g-lab { background: var(--sunk); }
.g-head { background: var(--sunk); }
.tick { position: absolute; top: 0; bottom: 0; border-inline-start: 1px solid var(--line); padding-inline-start: 5px; font-size: 11px; color: var(--muted); white-space: nowrap; line-height: 1.4; padding-top: 5px; }
.tick b { color: var(--fg2); font-weight: 700; display: block; }
.bar { position: absolute; top: 7px; height: 32px; border-radius: 5px; background: color-mix(in oklab, var(--c) 24%, var(--surface)); border: 1px solid color-mix(in oklab, var(--c) 55%, var(--surface)); border-inline-start: 4px solid var(--c); padding-inline: 5px 4px; font-size: 11px; line-height: 1.25; overflow: hidden; color: var(--fg); text-decoration: none; display: flex; flex-direction: column; justify-content: center; white-space: nowrap; }
.bar .bk { font-family: var(--f-mono); font-weight: 700; font-size: 10.5px; }
.bar .bt { color: var(--fg2); overflow: hidden; text-overflow: ellipsis; }
.bar.sugg { background-image: repeating-linear-gradient(45deg, color-mix(in oklab, var(--s0) 30%, transparent) 0 2px, transparent 2px 6px); }
.bar.gate { border-style: dashed; border-inline-start-style: solid; }
.bar.crit { box-shadow: 0 0 0 2px var(--fg); z-index: 1; }
.bar:hover { z-index: 2; filter: saturate(1.2); }
.mile-row .g-track { height: 58px; }
.mile { position: absolute; top: 6px; display: grid; justify-items: start; gap: 1px; font-size: 10.5px; white-space: nowrap; color: var(--fg2); transform: translateX(50%); }
[dir="rtl"] .mile { transform: translateX(50%); }
.mile i { width: 11px; height: 11px; transform: rotate(45deg); background: var(--c); display: block; margin-inline-start: -5px; border: 1.5px solid var(--surface); box-shadow: 0 0 0 1px var(--c); }
.gate-line { position: absolute; top: 0; bottom: 0; border-inline-start: 1.5px dashed var(--crit); z-index: 2; pointer-events: none; }
.gate-line span { position: absolute; top: 2px; inset-inline-start: 4px; font-size: 10.5px; color: var(--crit); white-space: nowrap; background: var(--surface); padding: 0 4px; border-radius: 4px; }

/* epic table */
.tbl-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 9px 12px; text-align: start; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-size: 12px; color: var(--fg2); font-weight: 700; background: var(--sunk); }
tbody tr:last-child td { border-bottom: 0; }
td.n { font-variant-numeric: tabular-nums; }
.span-cell { min-width: 260px; width: 40%; }
.span { position: relative; height: 12px; background: var(--grid); border-radius: 6px; }
.span i { position: absolute; top: 0; bottom: 0; border-radius: 6px; background: var(--c); }
.ep-name { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
.ep-name a { color: var(--muted); font-weight: 500; text-decoration: none; }
.ep-name a:hover { color: var(--accent); }

/* notes */
.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.note { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 14px 16px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.note h3 { font-size: 14.5px; font-weight: 800; display: flex; gap: 8px; align-items: center; }
.note ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 4px; font-size: 13px; color: var(--fg2); }
.note a { color: var(--accent); text-decoration: none; }
.note a:hover { text-decoration: underline; }
.pill { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 10px; border: 1px solid currentColor; }
.pill.warn { color: color-mix(in oklab, var(--warn) 70%, var(--fg)); }
.pill.good { color: var(--good); }
.pill.info { color: var(--accent); }

/* sprint proposal */
.sub-h { font-size: 15px; font-weight: 800; margin-top: 6px; }
.sp-next { background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--accent); border-radius: var(--r); padding: 16px; display: grid; gap: 14px; }
.sp-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 28px; }
.sp-head .t { display: grid; gap: 4px; min-width: 0; max-width: 72ch; }
.sp-head h3 { font-size: 19px; font-weight: 800; }
.sp-goal { color: var(--fg2); font-size: 13.5px; }
.sp-goal b { color: var(--fg); }
.sp-stats { display: grid; grid-template-columns: repeat(2, minmax(150px, 1fr)); gap: 8px 22px; font-size: 12.5px; color: var(--fg2); align-content: start; }
.sp-stats .v { font-size: 20px; font-weight: 800; color: var(--fg); font-variant-numeric: tabular-nums; line-height: 1.2; }
.load { display: grid; gap: 3px; }
.load .b2 { height: 7px; background: var(--grid); border-radius: 4px; overflow: hidden; }
.load .b2 i { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
.load .b2 i.over { background: var(--crit); }
.sp-epics { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.sp-ep { border: 1px solid var(--line); border-inline-start: 4px solid var(--c); border-radius: 6px; padding: 8px 10px; display: grid; gap: 6px; align-content: start; min-width: 0; background: color-mix(in oklab, var(--c) 5%, var(--surface)); }
.sp-ep-h { font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.sp-ep-h small { font-weight: 400; color: var(--muted); }
.sp-ep ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.sp-ep li { font-size: 12.5px; display: grid; gap: 1px; }
.sp-ep li .l1 { display: flex; gap: 6px; align-items: baseline; }
.sp-ep li .l1 span { min-width: 0; }
.sp-ep li a { font-family: var(--f-mono); font-size: 11px; color: var(--accent); text-decoration: none; flex: none; }
.sp-ep li a:hover { text-decoration: underline; }
.sp-ep li .m2 { font-size: 11px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.tg { font-size: 10.5px; font-weight: 700; padding: 0 6px; border-radius: 8px; border: 1px solid currentColor; line-height: 16px; }
.tg.crit { color: var(--fg); }
.tg.dec { color: color-mix(in oklab, var(--warn) 70%, var(--fg)); }
.tg.ext { color: var(--crit); }
.tg.ip { color: var(--accent); }
.tg.carry { color: var(--muted); }
.tg.goal { color: var(--good); }
.sp-foot { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; font-size: 12.5px; color: var(--fg2); border-top: 1px dashed var(--line); padding-top: 12px; }
.sp-foot h4 { margin: 0 0 4px; font-size: 13px; color: var(--fg); }
.sp-foot ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 2px; }
.sp-foot a { color: var(--accent); text-decoration: none; }
.mx th, .mx td { text-align: center; padding: 6px 8px; }
.mx th:first-child, .mx td:first-child { text-align: start; position: sticky; inset-inline-start: 0; z-index: 1; background: var(--surface); }
.mx thead th:first-child { background: var(--sunk); }
.mx th small { display: block; font-weight: 400; color: var(--muted); font-size: 10.5px; }
.mx th.next { color: var(--accent); }
.mx td.next, .mx th.next { background: var(--accent-soft); }
.mx .cell { display: inline-grid; place-items: center; min-width: 28px; height: 22px; padding-inline: 4px; border-radius: 5px; font-weight: 700; font-size: 12px; background: color-mix(in oklab, var(--c) var(--p), var(--surface)); color: var(--fg); font-variant-numeric: tabular-nums; }
.mx .cell.act { background: transparent; border: 1.5px dashed color-mix(in oklab, var(--c) 60%, var(--surface)); color: var(--muted); font-weight: 400; }
.mx .cell.fin { box-shadow: 0 0 0 2px var(--good); }
.mx tfoot td { font-weight: 700; background: var(--sunk); font-variant-numeric: tabular-nums; }
.mx tfoot td:first-child { background: var(--sunk); }

details.raw { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); }
details.raw summary { padding: 10px 16px; cursor: pointer; font-weight: 700; font-size: 13.5px; }
details.raw .tbl-scroll { border: 0; border-top: 1px solid var(--line); border-radius: 0; max-height: 520px; overflow: auto; }

#tip { position: fixed; z-index: 50; pointer-events: none; max-width: 320px; background: var(--fg); color: var(--bg); border-radius: 8px; padding: 8px 11px; font-size: 12px; line-height: 1.6; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
#tip b { font-weight: 800; }
#tip .k { font-family: var(--f-mono); opacity: .8; }

@media (max-width: 640px) {
  .wrap { padding-inline: 16px; }
  .controls .sep { display: none; }
  .kpi .v { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
`;
