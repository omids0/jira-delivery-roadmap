import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { qualityNotes } from '../src/quality.js';
import { createEnv } from '../src/render/env.js';
import { renderHome, renderPage, setPageTheme, workweekLabel } from '../src/render/page.js';
import { baseState, fixture } from '../test-support/fixture.js';

const settings = { team: { be: 1, fe: 1 }, parallelStories: 3, components: { be: 'Back-End', fe: '"><b>x' } };
const page = (over = {}) => {
  const ctx = fixture();
  const R = createEnv(ctx, createEngine(ctx), { ...baseState, ...over });
  return renderPage(R, { projects: [{ key: 'P', name: '<i>Proj</i>' }], user: 'u', key: 'P', projectName: 'Proj', settings, notes: ['note <x>'] });
};

test('page has every section container the UI fills by id', () => {
  const html = page();
  for (const id of ['team', 'sp-cfg', 'sp-now', 'kpis', 'whatif', 'ov', 'ov-progress', 'vel-tbl', 'flow', 'flow-q', 'gantt', 'own-tbl', 'people', 'epic-tbl', 'notes', 'sp-next', 'sp-matrix', 'raw-tbl', 'refresh-btn', 'jr-confirm', 'jr-project']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});

test('controls show the state; values from Jira are escaped', () => {
  const html = page({ be: 3, pace: 'pes' });
  assert.match(html, /id="be-n">۳</);
  assert.match(html, /id="pace-pes" value="pes" checked/);
  assert.ok(!html.includes('<i>Proj</i>') && html.includes('&lt;i&gt;Proj&lt;/i&gt;'));
  assert.ok(html.includes('&quot;&gt;&lt;b&gt;x'));
  assert.ok(html.includes('note &lt;x&gt;'));
});

test('no developer text in the user view', () => {
  const html = page();
  assert.ok(!/DESIGN\.md|projects\.json/.test(html));
});

test('home page has the picker, and an error is shown escaped', () => {
  const html = renderHome({ projects: [{ key: 'P', name: 'n' }], user: '', error: '<bad>' });
  assert.ok(html.includes('id="jr-project"') && html.includes('&lt;bad&gt;'));
});

test('workweek label: Saturday to Wednesday for a Thursday-Friday weekend', () => {
  assert.equal(workweekLabel([4, 5], 'fa-IR'), 'شنبه تا چهارشنبه');
});

test('quality notes: warn only about what is actually missing', () => {
  const ok = { open: 7, withBlockers: 2, noSubtasks: 0, noEpic: 0, externalOpen: 0 };
  assert.deepEqual(qualityNotes(ok), []);
  const notes = qualityNotes({ ...ok, withBlockers: 0, noSubtasks: 4, noEpic: 2, externalOpen: 1 });
  assert.equal(notes.length, 4);
  assert.match(notes[0], /Blocks/);
  assert.equal(qualityNotes({ ...ok, open: 0, withBlockers: 0 }).length, 0);
});

test('header: picker sits next to the title; refresh and theme come before close; refresh is not in the controls', () => {
  const html = page();
  const at = (s) => html.indexOf(s);
  assert.ok(at('<b>نقشه راه تحویل</b>') < at('id="jr-project"'));
  assert.ok(at('id="jr-project"') < at('id="refresh-btn"'));
  assert.ok(at('id="refresh-btn"') < at('id="jr-theme"') && at('id="jr-theme"') < at('id="jr-close"'));
  assert.ok(at('id="refresh-btn"') < at('class="controls"'));
});

test('theme: pages carry data-theme only when one is chosen; every page has the toggle', () => {
  setPageTheme('dark');
  assert.match(renderHome({ projects: [], user: '' }), /<html lang="fa" dir="rtl" data-theme="dark">/);
  assert.ok(renderHome({ projects: [], user: '', fatal: true }).includes('id="jr-theme"'));
  setPageTheme('light');
  assert.match(page(), /data-theme="light"/);
  setPageTheme(null);
  assert.ok(renderHome({ projects: [], user: '' }).includes('<html lang="fa" dir="rtl">'));
});

test('the page markup has no blocking external stylesheet (it must render without internet access)', () => {
  assert.ok(!/<link[^>]+stylesheet/i.test(page()));
  assert.ok(!/<link[^>]+stylesheet/i.test(renderHome({ projects: [], user: '' })));
});
