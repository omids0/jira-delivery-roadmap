// Planning engine: turns the story list into tasks, schedules them on the
// team (critical-path priority, epic ownership, parallel slots) and derives the
// critical chain, per-epic finish and sprint proposal. Pure: no DOM, no network.
//
// ctx (built by src/adapter.js):
//   today: Date, weekend: number[], locale: string
//   EP: { [code]: { k: epicKey|null, n: name, t: colorIndex } }, EP_ORDER: string[]
//   stories: base story list, see adapter.js (cloned on every plan)
//   SPRINTS: closed sprints with measured output, NEXT_SPRINT: { n, start, len, firstLen, target? }
//   priority: { high: epicKeys, low: epicKeys, holdLow: boolean }
//   defaults: { storyPace }, defaultPace: { BE, FE }
import { createCalendar, parseDay } from './calendar.js';

export const C_START = 0.5; // contract-first: FE starts at half of BE ...
export const C_END = 0.1; // ... and ends at least 0.1 day after BE
export const GATE = 3; // workday by which open decisions are assumed to be settled

/** Pace per developer per workday, calibrated from closed sprints (sub-tasks Done by sprint close). */
export function computePace(SPRINTS, defaultPace) {
  const d = defaultPace;
  const nz = (v, x) => (Number.isFinite(v) && v > 0 ? v : x);
  if (!SPRINTS.length) {
    return {
      avg: { BE: d.BE, FE: d.FE, n: 'سرعت فرضی (بدون سابقهٔ اسپرینت)' },
      opt: { BE: d.BE * 1.25, FE: d.FE * 1.25, n: 'فرضی، خوش‌بینانه' },
      pes: { BE: d.BE * 0.75, FE: d.FE * 0.75, n: 'فرضی، محتاطانه' }
    };
  }
  const perHead = (r, sp) => sp[r] / (sp.wd * sp[r + 'Heads']);
  const days = (r) => SPRINTS.reduce((a, sp) => a + sp.wd * sp[r + 'Heads'], 0);
  const tot = (r) => SPRINTS.reduce((a, sp) => a + sp[r], 0);
  const ph = (r) => SPRINTS.map((sp) => perHead(r, sp));
  const avg = { BE: nz(tot('be') / days('be'), d.BE), FE: nz(tot('fe') / days('fe'), d.FE) };
  return {
    avg: Object.assign(avg, { n: 'میانگین وزنی اسپرینت‌های قبل' }),
    opt: { BE: nz(Math.max(...ph('be')), avg.BE), FE: nz(Math.max(...ph('fe')), avg.FE), n: 'بهترین اسپرینت هر نقش' },
    pes: { BE: nz(Math.min(...ph('be')), avg.BE), FE: nz(Math.min(...ph('fe')), avg.FE), n: 'ضعیف‌ترین اسپرینت هر نقش' }
  };
}

export function createEngine(ctx) {
  const cal = createCalendar({ start: ctx.today, weekend: ctx.weekend, locale: ctx.locale });
  const { wdIndex } = cal;
  const { EP, EP_ORDER } = ctx;
  const PACE = computePace(ctx.SPRINTS, ctx.defaultPace);
  const STORY_PACE = ctx.SPRINTS.length
    ? ctx.SPRINTS.reduce((a, sp) => a + sp.stories, 0) / ctx.SPRINTS.reduce((a, sp) => a + sp.wd, 0)
    : ctx.defaults.storyPace;
  const NEXT = ctx.NEXT_SPRINT;

  /** Working list for one set of toggles: filtered, with remaining sub-task counts, ready-to-close and priority rank. */
  function stories(opts) {
    let list = ctx.stories.map((s) => ({ ...s, deps: s.deps.slice(), f: s.f.slice(), known: { ...s.known } }));
    list = list.filter((s) => !(s.f.includes('def') && !opts.def) && !(s.f.includes('p2') && !opts.p2) && !(s.f.includes('p3') && !opts.p3));
    const keys = new Set(list.map((s) => s.k));
    list.forEach((s) => {
      s.deps = s.deps.filter((d) => keys.has(d));
      if (s.done || s.rc) {
        s.sbe = 0;
        s.sfe = 0;
        return;
      }
      s.sbe = s.known.be != null ? s.known.be : s.be > 0 ? Math.max(1, Math.round(s.be)) : 0;
      s.sfe = s.known.fe != null ? s.known.fe : s.fe > 0 ? Math.max(1, Math.round(s.fe)) : 0;
      if (!s.f.includes('x') && s.sbe === 0 && s.sfe === 0) s.rc = true; // open in Jira, nothing left to build
    });
    // epic priority: a story inherits the highest priority of any open story that waits on it
    const PR = ctx.priority || {};
    const byK = Object.fromEntries(list.map((s) => [s.k, s]));
    const own = (s) => {
      const k = (EP[s.ep] || {}).k;
      return (PR.high || []).includes(k) ? 0 : (PR.low || []).includes(k) ? 2 : 1;
    };
    const nxt = {};
    list.forEach((s) => s.deps.forEach((d) => (nxt[d] = nxt[d] || []).push(s.k)));
    const memo = {};
    const eff = (k) => {
      if (memo[k] != null) return memo[k];
      let r = (memo[k] = own(byK[k]));
      (nxt[k] || []).forEach((x) => {
        if (!byK[x].done) r = Math.min(r, eff(x));
      });
      return (memo[k] = r);
    };
    list.forEach((s) => {
      s.rank = eff(s.k);
      s.lowCrit = own(s) === 2 && s.rank < 2;
    });
    return list;
  }

  function buildTasks(list, pace, off, par) {
    const tasks = [];
    const tk = {};
    const holdLow = ctx.priority?.holdLow && NEXT ? wdIndex(parseDay(NEXT.start)) + (NEXT.firstLen || NEXT.len || 10) : 0;
    list.forEach((s) => {
      ['BE', 'FE'].forEach((r) => {
        const subs = r === 'BE' ? s.sbe : s.sfe;
        if (subs > 0) {
          const t = {
            id: s.k + ':' + r, role: r, subs, dur: Math.round((100 * subs * par) / pace[r]) / 100, s, preds: [], succ: [],
            release: Math.max(off + (s.f.includes('d') ? GATE : 0), s.rank === 2 ? holdLow : 0)
          };
          tasks.push(t);
          tk[t.id] = t;
        }
      });
    });
    const link = (from, to, type) => {
      to.preds.push({ t: from, type });
      from.succ.push({ t: to, type });
    };
    tasks.forEach((t) => {
      const s = t.s;
      if (t.role === 'FE' && tk[s.k + ':BE']) link(tk[s.k + ':BE'], t, 'c');
      s.deps.forEach((d) => {
        const same = tk[d + ':' + t.role];
        if (same) return link(same, t, 'fs');
        if (t.role === 'FE') {
          const other = tk[d + ':BE'];
          if (other) link(other, t, 'fs');
        }
      });
    });
    const memo = {};
    const bl = (t) => {
      if (memo[t.id] != null) return memo[t.id];
      let v = t.dur;
      t.succ.forEach((e) => {
        const o = e.type === 'c' ? Math.max(C_START * t.dur, t.dur + C_END - e.t.dur) : t.dur;
        v = Math.max(v, o + bl(e.t));
      });
      return (memo[t.id] = v);
    };
    tasks.forEach((t) => {
      t.bl = bl(t);
    });
    return tasks;
  }

  function earliest(t, sched) {
    let es = t.release;
    for (const p of t.preds) {
      const pd = sched.get(p.t.id);
      if (!pd) continue; // predecessor not placed (dependency cycle fallback)
      if (p.type === 'fs') es = Math.max(es, pd.e);
      else es = Math.max(es, pd.s + C_START * p.t.dur, pd.e + C_END - t.dur);
    }
    return es;
  }

  // Each epic's backend work belongs to one backend developer and its front-end work to one front-end developer.
  // Manual choices (keyed by epic key) win; the rest go to whoever has the least work so far.
  function resolveOwners(list, nBE, nFE, manual) {
    const own = { BE: {}, FE: {} };
    const need = { BE: {}, FE: {} };
    const load = { BE: Array(nBE).fill(0), FE: Array(nFE).fill(0) };
    [['BE', nBE, 'sbe'], ['FE', nFE, 'sfe']].forEach(([r, n, f]) => {
      list.forEach((s) => {
        if (!s.done && !s.rc && s[f] > 0) need[r][s.ep] = (need[r][s.ep] || 0) + s[f];
      });
      const eps = Object.keys(need[r]).sort((a, b) => need[r][b] - need[r][a] || EP_ORDER.indexOf(a) - EP_ORDER.indexOf(b));
      eps.forEach((ep) => {
        const key = (EP[ep] || {}).k;
        const m = manual && manual[r] && key ? manual[r][key] : null;
        if (m != null && m >= 0 && m < n) {
          own[r][ep] = m;
          load[r][m] += need[r][ep];
        }
      });
      eps.forEach((ep) => {
        if (own[r][ep] != null || !n) return;
        let i = 0;
        for (let j = 1; j < n; j++) if (load[r][j] < load[r][i]) i = j;
        own[r][ep] = i;
        load[r][i] += need[r][ep];
      });
    });
    return { own, need, load };
  }

  // Each developer runs up to `par` stories at once (one slot each), never two from the same epic at the same time.
  // A dev's measured daily output is shared across their slots, so each story runs `par` times longer in wall-clock.
  function schedule(tasks, nBE, nFE, off, par, owners) {
    const devs = { BE: [], FE: [] };
    [['BE', nBE], ['FE', nFE]].forEach(([r, n]) => {
      for (let i = 0; i < n; i++) devs[r].push({ slots: Array(par).fill(off), placed: [] });
    });
    const sched = new Map();
    const left = new Set(tasks);
    const ownerOf = (t) => (owners && owners.own[t.role][t.s.ep] != null ? owners.own[t.role][t.s.ep] : null);
    const fit = (t, es) => {
      let best = null;
      const o = ownerOf(t);
      devs[t.role].forEach((d, di) => {
        if (o != null && di !== o) return;
        d.slots.forEach((free, si) => {
          let st = Math.max(es, free);
          let moved = true;
          while (moved) {
            moved = false;
            for (const p of d.placed) {
              if (p.ep === t.s.ep && p.s < st + t.dur - 1e-9 && st < p.e - 1e-9) {
                st = p.e;
                moved = true;
              }
            }
          }
          if (!best || st < best.st - 1e-9) best = { st, di, si };
        });
      });
      return best;
    };
    while (left.size) {
      let cand = [];
      left.forEach((t) => {
        if (!t.preds.every((p) => sched.has(p.t.id))) return;
        const f = fit(t, earliest(t, sched));
        if (f) cand.push({ t, st: f.st, li: f.di, si: f.si });
      });
      if (!cand.length) { // dependency cycle (or no developer for the role): place the first remaining task as if its predecessors were done
        const t = [...left][0];
        const f = fit(t, t.release) || { st: t.release, di: 0, si: 0 };
        cand.push({ t, st: f.st, li: f.di, si: f.si });
      }
      const m = Math.min(...cand.map((c) => c.st));
      // critical-path priority first (half-day buckets), then the epic with the fewest stories already running
      const running = (ep) => {
        let n = 0;
        sched.forEach((v) => {
          if (v.t.s.ep === ep && v.s <= m + 1e-9 && v.e > m + 1e-9) n++;
        });
        return n;
      };
      cand = cand
        .filter((c) => c.st <= m + 0.25)
        .map((c) => Object.assign(c, { pr: Math.round(c.t.bl * 2) / 2, run: running(c.t.s.ep) }))
        .sort((a, b) => (a.t.s.rank || 0) - (b.t.s.rank || 0) || b.pr - a.pr || a.run - b.run || a.st - b.st);
      const c = cand[0];
      const e = c.st + c.t.dur;
      sched.set(c.t.id, { t: c.t, s: c.st, e, lane: c.li, slot: c.si });
      const d = devs[c.t.role][c.li];
      if (d) {
        d.slots[c.si] = e;
        d.placed.push({ s: c.st, e, ep: c.t.s.ep });
      }
      left.delete(c.t);
    }
    return sched;
  }

  /** Finish time with unlimited people: the lower bound set by dependencies alone. */
  function unlimited(tasks) {
    const sched = new Map();
    const left = new Set(tasks);
    while (left.size) {
      let moved = false;
      left.forEach((t) => {
        if (t.preds.every((p) => sched.has(p.t.id))) {
          const s = earliest(t, sched);
          sched.set(t.id, { s, e: s + t.dur });
          left.delete(t);
          moved = true;
        }
      });
      if (!moved) {
        const t = [...left][0];
        const s = earliest(t, sched);
        sched.set(t.id, { s, e: s + t.dur });
        left.delete(t);
      }
    }
    return Math.max(0, ...[...sched.values()].map((v) => v.e));
  }

  /** Ids of the tasks on the chain that decides the finish date. */
  function criticalChain(sched) {
    const all = [...sched.values()];
    if (!all.length) return new Set();
    let cur = all.reduce((a, b) => (b.e > a.e ? b : a));
    const set = new Set([cur.t.id]);
    const eq = (a, b) => Math.abs(a - b) < 1e-6;
    for (let guard = 0; guard < 400 && cur.s > 1e-6; guard++) {
      let next = null;
      for (const p of cur.t.preds) {
        const pd = sched.get(p.t.id);
        if (!pd) continue;
        const bind = p.type === 'fs' ? eq(pd.e, cur.s) : eq(pd.s + C_START * p.t.dur, cur.s) || eq(pd.e + C_END - cur.t.dur, cur.s);
        if (bind) {
          next = pd;
          break;
        }
      }
      // capacity blockers: the previous story in the same slot, or a same-epic story on the same developer
      if (!next) {
        next = all.find((o) => o.t.role === cur.t.role && o.lane === cur.lane && o.slot === cur.slot && eq(o.e, cur.s))
          || all.find((o) => o.t.role === cur.t.role && o.lane === cur.lane && o.t.s.ep === cur.t.s.ep && eq(o.e, cur.s)) || null;
      }
      if (!next) break;
      set.add(next.t.id);
      cur = next;
    }
    return set;
  }

  /** @param {{be:number, fe:number, pace:string, par:number, p2:boolean, p3:boolean, def:boolean, own?:object}} state */
  function plan(state) {
    const off = 0;
    const list = stories(state);
    const par = Math.max(1, state.par || 1);
    const owners = resolveOwners(list, state.be, state.fe, state.own);
    const tasks = buildTasks(list, PACE[state.pace] || PACE.avg, off, par);
    const sched = schedule(tasks, state.be, state.fe, off, par, owners);
    const span = Math.max(off, ...[...sched.values()].map((v) => v.e));
    return { list, tasks, sched, span, off, owners };
  }

  function epicFinish(P) {
    const out = {};
    P.sched.forEach((v) => {
      const ep = v.t.s.ep;
      const o = (out[ep] = out[ep] || { s: Infinity, e: 0, be: 0, fe: 0, n: new Set() });
      o.s = Math.min(o.s, v.s);
      o.e = Math.max(o.e, v.e);
      o[v.t.role.toLowerCase()] += v.t.subs;
      o.n.add(v.t.s.k);
    });
    return out;
  }

  /** Sprint-by-sprint proposal: which stories finish in which sprint, load vs capacity, epic goals. */
  function sprintPlan(P, state) {
    const SPRINT_LEN = NEXT.len || 10;
    const s0 = wdIndex(parseDay(NEXT.start));
    const n0 = NEXT.n;
    const FIRST = NEXT.firstLen || SPRINT_LEN;
    const sprintOf = (d) => (d < s0 ? n0 - 1 : d < s0 + FIRST ? n0 : n0 + 1 + Math.floor((d - s0 - FIRST) / SPRINT_LEN));
    const win = (n) => (n < n0 ? [P.off, s0] : n === n0 ? [s0, s0 + FIRST] : [s0 + FIRST + (n - n0 - 1) * SPRINT_LEN, s0 + FIRST + (n - n0) * SPRINT_LEN]);
    const st = {};
    P.sched.forEach((v) => {
      const k = v.t.s.k;
      const o = (st[k] = st[k] || { s: v.s, e: v.e, story: v.t.s, be: 0, fe: 0 });
      o.s = Math.min(o.s, v.s);
      o.e = Math.max(o.e, v.e);
      o[v.t.role.toLowerCase()] += v.t.subs;
    });
    const fin = epicFinish(P);
    // NEXT.target: the proposed sprint takes the N earliest-finishing stories; the ones past its window are stretch
    const natural = (o) => sprintOf(o.e - 1e-6);
    const pick = NEXT.target
      ? new Set(Object.values(st).filter((o) => !o.story.f.includes('x') && o.story.rank !== 2).sort((a, b) => a.e - b.e).slice(0, NEXT.target).map((o) => o.story.k))
      : null;
    const sprintOfStory = (o) => (!pick ? natural(o) : pick.has(o.story.k) ? Math.min(natural(o), n0) : Math.max(natural(o), n0 + 1));
    Object.values(st).forEach((o) => {
      o.stretch = !!pick && pick.has(o.story.k) && natural(o) > n0;
    });
    const last = Math.max(sprintOf(Math.max(P.off, P.span - 1e-6)), ...Object.values(st).map(sprintOfStory));
    const out = [];
    for (let n = NEXT.n - 1; n <= last; n++) {
      const [w0, w1] = win(n);
      const a0 = Math.max(w0, P.off);
      if (w1 <= a0) continue;
      const done = Object.values(st).filter((o) => sprintOfStory(o) === n).sort((a, b) => a.e - b.e);
      const started = Object.values(st).filter((o) => sprintOf(o.s) === n && sprintOf(o.e - 1e-6) > n);
      const load = { BE: 0, FE: 0 };
      const active = {};
      P.sched.forEach((v) => {
        const a = Math.max(v.s, a0);
        const b = Math.min(v.e, w1);
        if (b > a) {
          load[v.t.role] += (v.t.subs * (b - a)) / v.t.dur;
          active[v.t.s.ep] = true;
        }
      });
      const days = w1 - a0;
      const cap = { BE: state.be * PACE[state.pace].BE * days, FE: state.fe * PACE[state.pace].FE * days };
      const goals = Object.entries(fin).filter(([ep, f]) => ep !== 'en' && sprintOf(f.e - 1e-6) === n).map(([ep]) => ep);
      out.push({ n, w0: a0, w1, done, started, load, cap, active: Object.keys(active), goals, days });
    }
    return { sprints: out, sprintOf };
  }

  return { cal, PACE, STORY_PACE, stories, plan, unlimited, criticalChain, epicFinish, sprintPlan, resolveOwners };
}
