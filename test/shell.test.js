import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, renderHome, renderProject } from '../src/render/shell.js';

test('esc escapes HTML metacharacters', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('project names are escaped in the selector', () => {
  const html = renderHome({ projects: [{ key: 'ABC', name: '<script>x</script>' }], user: 'u' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('selected project is marked and story count shown', () => {
  const html = renderProject({ projects: [{ key: 'ABC', name: 'Abc' }], user: '', key: 'ABC', openStories: 7, settings });
  assert.match(html, /<option value="ABC" selected>/);
  assert.match(html, /<b>7<\/b>/);
});

const settings = { team: { be: 2, fe: 3 }, parallelStories: 4, components: { be: 'API', fe: '"><b>x' } };

test('settings form shows saved values, escapes them, and has a confirm button', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', openStories: 0, settings });
  assert.match(html, /id="jr-be" value="2"/);
  assert.match(html, /id="jr-cfe" value="&quot;&gt;&lt;b&gt;x"/);
  assert.match(html, /id="jr-confirm"/);
  assert.ok(!html.includes('ذخیره شد'));
});

test('saved flag shows the confirmation', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', openStories: 0, settings, saved: true });
  assert.ok(html.includes('ذخیره شد'));
});

test('no developer text or raw JSON in the user view', () => {
  const html = renderProject({ projects: [], user: '', key: 'ABC', openStories: 0, settings });
  assert.ok(!html.includes('DESIGN.md'));
  assert.ok(!html.includes('projects.json'));
});
