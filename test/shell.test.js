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
  const html = renderProject({ projects: [{ key: 'ABC', name: 'Abc' }], user: '', key: 'ABC', openStories: 7, config: {} });
  assert.match(html, /<option value="ABC" selected>/);
  assert.match(html, /<b>7<\/b>/);
});
