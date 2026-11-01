// Synthetic Jira project used by the engine and renderer tests (no real data).
import { buildContext } from '../src/adapter.js';
import { buildModel } from '../src/model.js';

export const cfg = { components: { be: 'Back-End', fe: 'Front-End' }, labels: {}, weekend: [4, 5], locale: 'en-US', team: { be: 1, fe: 1 }, parallelStories: 1 };
const st = (c) => ({ name: c, statusCategory: { key: c, name: c } });
const link = (inward) => ({ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: inward, fields: { status: st('new') } } });
const story = (key, epic, extra = {}) => ({ key, fields: { summary: key, status: st('new'), labels: [], components: [], issuelinks: [], customfield_1: epic, assignee: null, resolutiondate: null, ...extra } });
const sub = (key, parent, role, extra = {}) => ({ key, fields: { summary: 'x', status: st('new'), components: [{ name: role === 'be' ? 'Back-End' : 'Front-End' }], labels: [], parent: { key: parent }, assignee: { displayName: role === 'be' ? 'Bea' : 'Fay' }, resolutiondate: null, ...extra } });

export function fixture() {
  const subtasks = [];
  const add = (parent, be, fe) => {
    for (let i = 0; i < be; i++) subtasks.push(sub(`${parent}-b${i}`, parent, 'be'));
    for (let i = 0; i < fe; i++) subtasks.push(sub(`${parent}-f${i}`, parent, 'fe'));
  };
  const stories = [
    story('P-1', 'P-100'), story('P-2', 'P-100', { issuelinks: [link('P-1')] }), story('P-3', 'P-200', { issuelinks: [link('P-2')] }),
    story('P-4', 'P-200'), story('P-5', 'P-100', { status: st('done'), resolutiondate: '2026-10-01T10:00:00.000+0000' })
  ];
  add('P-1', 12, 6); add('P-2', 12, 6); add('P-3', 6, 12); add('P-4', 12, 0);
  // two closed sprints with measured output
  for (let i = 0; i < 20; i++) subtasks.push(sub(`d${i}`, 'P-5', i % 2 ? 'fe' : 'be', { status: st('done'), resolutiondate: '2026-09-20T10:00:00.000+0000' }));
  const epics = [100, 200].map((n) => ({ key: `P-${n}`, fields: { summary: `Epic ${n}`, status: st('new') } }));
  const raw = { epics, stories, subtasks, epicField: 'customfield_1', assigned: [], sprints: [
    { id: 1, name: 'Sprint 3', state: 'closed', startDate: '2026-09-13T08:00:00.000Z', endDate: '2026-09-27T08:00:00.000Z', completeDate: '2026-09-27T08:00:00.000Z' },
    { id: 2, name: 'Sprint 4', state: 'active', startDate: '2026-10-11T08:00:00.000Z', endDate: '2026-10-25T08:00:00.000Z' }
  ] };
  const model = buildModel(raw, cfg);
  return buildContext({ raw, model, sprints: raw.sprints, assigned: [], cfg, baseUrl: 'https://jira.example', project: 'P', now: new Date(2026, 9, 20, 12) });
}


export const baseState = { be: 1, fe: 1, pace: 'avg', par: 1, p2: true, p3: true, def: false, hist: true, own: { BE: {}, FE: {} } };
