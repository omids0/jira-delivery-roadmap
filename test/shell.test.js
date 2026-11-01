import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, qualityNotes, renderHome, renderProject } from '../src/render/shell.js';

const c = (open, total) => ({ open, total });
const summary = {
  open: 7, done: 3, noEpic: 0, noSubtasks: 0, withBlockers: 2, externalOpen: 0,
  epics: [{ key: 'ABC-1', name: '<Checkout>', openStories: 4, doneStories: 1, be: c(3, 5), fe: c(2, 4) }]
};

test('esc escapes HTML metacharacters', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('project names are escaped in the selector', () => {
  const html = renderHome({ projects: [{ key: 'ABC', name: '<script>x</script>' }], user: 'u' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('selected project is marked and story count shown', () => {
  const html = renderProject({ projects: [{ key: 'ABC', name: 'Abc' }], user: '', key: 'ABC', summary, settings });
  assert.match(html, /<option value="ABC" selected>/);
  assert.match(html, /<b>7<\/b>/);
});

const settings = { team: { be: 2, fe: 3 }, parallelStories: 4, components: { be: 'API', fe: '"><b>x' } };

test('settings form shows saved values, escapes them, and has a confirm button', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', summary, settings });
  assert.match(html, /id="jr-be" value="2"/);
  assert.match(html, /id="jr-cfe" value="&quot;&gt;&lt;b&gt;x"/);
  assert.match(html, /id="jr-confirm"/);
  assert.ok(!html.includes('ذخیره شد'));
});

test('saved flag shows the confirmation', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', summary, settings, saved: true });
  assert.ok(html.includes('ذخیره شد'));
});

test('no developer text or raw JSON in the user view', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', summary, settings });
  assert.ok(!html.includes('DESIGN.md'));
  assert.ok(!html.includes('projects.json'));
});

test('epic table lists epics with escaped names and sub-task counts', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', summary, settings });
  assert.ok(html.includes('&lt;Checkout&gt;'));
  assert.ok(!html.includes('<Checkout>'));
  assert.ok(html.includes('3<span class="muted"> / 5</span>'));
});

test('quality notes: warn only about what is actually missing', () => {
  assert.deepEqual(qualityNotes(summary), []);
  const notes = qualityNotes({ ...summary, withBlockers: 0, noSubtasks: 4, noEpic: 2, externalOpen: 1 });
  assert.equal(notes.length, 4);
  assert.match(notes[0], /Blocks/);
  assert.equal(qualityNotes({ ...summary, open: 0, withBlockers: 0 }).length, 0);
});
