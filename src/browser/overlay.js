// Paints the roadmap in a full-screen overlay on top of the current Jira page.
import projectsFile from '../../config/projects.json';
import { makeProjectConfig } from '../projectConfig.js';
import { createBrowserApp } from './app.js';

const OVERLAY_ID = 'jira-roadmap-overlay';

function contextPath() {
  const meta = document.querySelector('meta[name="ajs-context-path"]');
  return (meta?.content || '').replace(/\/+$/, '');
}

function createOverlay() {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff;';
  const iframe = document.createElement('iframe');
  iframe.title = 'Jira delivery roadmap';
  iframe.style.cssText = 'border:0;width:100%;height:100%;display:block;';
  root.appendChild(iframe);
  document.body.appendChild(root);
  return { root, iframe };
}

/** Opens (or re-opens) the roadmap. */
export function openRoadmap() {
  document.getElementById(OVERLAY_ID)?.remove();
  const { root, iframe } = createOverlay();
  const onKey = (e) => e.key === 'Escape' && close();
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
  };
  document.addEventListener('keydown', onKey);

  createBrowserApp({
    frame: { get document() { return iframe.contentDocument; } },
    baseUrl: location.origin + contextPath(),
    projectConfig: makeProjectConfig(projectsFile),
    storage: window.localStorage,
    onClose: close
  }).start();
}
