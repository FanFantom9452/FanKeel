'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-agents.ts')).href);
const NOW = Date.parse('2026-10-16T03:00:00.000Z');
const M = 60000;
// Shapes measured on Claude Code 2.1.295: a brain's meta and prefix, and a reader it dispatched.
const brain = { id: 'b1', at: NOW - 10 * M, meta: { agentType: 'fankeel:fankeel-brain', description: 'sonnet 5.5 · medium: survey stage agent', spawnDepth: 1 }, prefix: { state: { model: 'claude-opus-5-5', effortValue: 'high' } } };
const reader = { id: 'r1', at: NOW - 8 * M, meta: { agentType: 'fankeel:fankeel-reader', description: 'sonnet 5.5 · low: Patrol check group C', parentAgentId: 'b1', spawnDepth: 2, model: 'sonnet' }, prefix: null };
const old = { id: 'o1', at: NOW - 90 * M, meta: { agentType: 'Explore', description: 'before the task' }, prefix: null };

test('modelAlias writes a model id the way the title hook does', async () => {
    const { modelAlias } = await load();
    assert.equal(modelAlias('claude-sonnet-5-5'), 'sonnet 5.5');
    assert.equal(modelAlias('claude-opus-5-5[1m]'), 'opus 5.5');
    assert.equal(modelAlias('claude-haiku-4-5-20251001'), 'haiku 4.5');
    assert.equal(modelAlias('sonnet'), 'sonnet');
});

test('agentTree hangs a reader under its brain, the model and effort from prefix first, then the title', async () => {
    const { agentTree } = await load();
    const tree = agentTree([reader, brain, old], { r1: NOW - 2 * M }, NOW - 60 * M);
    assert.equal(tree.length, 1);
    const [root] = tree;
    assert.deepEqual([root.id, root.title, root.type, root.model, root.effort, root.at, root.end], ['b1', 'survey stage agent', 'fankeel:fankeel-brain', 'opus 5.5', 'high', NOW - 10 * M, null]);
    assert.equal(root.kids.length, 1);
    const [kid] = root.kids;
    assert.deepEqual([kid.id, kid.title, kid.model, kid.effort, kid.end], ['r1', 'Patrol check group C', 'sonnet 5.5', 'low', NOW - 2 * M]);
});

test('a description with no title prefix is the title whole, and the model falls back to meta, else ?', async () => {
    const { agentTree } = await load();
    const bare = { id: 'x1', at: NOW, meta: { description: 'plain', model: 'haiku' }, prefix: null };
    const none = { id: 'x2', at: NOW, meta: { description: 'nothing' }, prefix: null };
    const [a, b] = agentTree([bare, none], {}, 0).sort((p, q) => p.id.localeCompare(q.id));
    assert.deepEqual([a.title, a.model, a.effort], ['plain', 'haiku', '?']);
    assert.deepEqual([b.title, b.model, b.effort], ['nothing', '?', '?']);
    assert.deepEqual(agentTree([{ id: 'x3', at: NOW, meta: null, prefix: null }], {}, 0), []);
});

test('running agents come before stopped ones, then the newest first', async () => {
    const { agentTree } = await load();
    const f = (id, at) => ({ id, at, meta: { description: id }, prefix: null });
    assert.deepEqual(agentTree([f('a', NOW - 3 * M), f('b', NOW - 2 * M), f('c', NOW - M)], { c: NOW }, 0).map((n) => n.id), ['b', 'a', 'c']);
});

test('an agent dispatched at the very ms the task started is listed, and one whose parent is not listed is a root', async () => {
    const { agentTree } = await load();
    const at = { id: 'e1', at: NOW - 60 * M, meta: { description: 'edge' }, prefix: null };
    assert.deepEqual(agentTree([at], {}, NOW - 60 * M).map((n) => n.id), ['e1']);
    const tree = agentTree([reader, old], {}, NOW - 60 * M);
    assert.deepEqual(tree.map((n) => [n.id, n.kids.length]), [['r1', 0]]);
});

test('a stopped agent with one still running under it sorts with the running, before a newer one stopped whole', async () => {
    const { agentTree } = await load();
    const f = (id, at, parent) => ({ id, at, meta: { description: id, ...(parent ? { parentAgentId: parent } : {}) }, prefix: null });
    const tree = agentTree([f('old', NOW - 5 * M), f('kid', NOW - 4 * M, 'old'), f('new', NOW - M)], { old: NOW - 3 * M, new: NOW }, 0);
    assert.deepEqual(tree.map((n) => n.id), ['old', 'new']);
    assert.deepEqual(tree[0].kids.map((n) => [n.id, n.end]), [['kid', null]]);
});

test('a running grandchild lifts every stopped ancestor above a newer stopped one', async () => {
    const { agentTree } = await load();
    const f = (id, at, parent) => ({ id, at, meta: { description: id, ...(parent ? { parentAgentId: parent } : {}) }, prefix: null });
    const files = [f('root', NOW - 9 * M), f('mid', NOW - 8 * M, 'root'), f('leaf', NOW - 7 * M, 'mid'), f('midNew', NOW - M, 'root'), f('rootNew', NOW - M)];
    const tree = agentTree(files, { root: NOW, mid: NOW, midNew: NOW, rootNew: NOW }, 0);
    assert.deepEqual(tree.map((n) => n.id), ['root', 'rootNew']);
    assert.deepEqual(tree[0].kids.map((n) => n.id), ['mid', 'midNew']);
});
