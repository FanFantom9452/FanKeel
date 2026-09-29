'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { parseModel, prefixFor, retitle } = require('../lib/title.js');

const said = (model) => JSON.stringify({ type: 'assistant', message: { model, content: [{ type: 'text', text: 'x' }] } }) + '\n';

// <root>/plugin/agents, <root>/config/agents, <root>/projects/p/<sid>.jsonl and its subagents.
function world() {
    const root = tmp('title-');
    const plugin = path.join(root, 'plugin');
    fs.mkdirSync(path.join(plugin, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'agents', 'fankeel-reader.md'), '---\nname: fankeel-reader\nmodel: sonnet\neffort: medium\n---\nbody\n');
    const proj = path.join(root, 'projects', 'p');
    fs.mkdirSync(proj, { recursive: true });
    const transcriptPath = path.join(proj, 'main.jsonl');
    fs.writeFileSync(transcriptPath, said('claude-opus-5-5'));
    return { root, plugin, proj, transcriptPath, configDir: path.join(root, 'config'), projectDir: path.join(root, 'cwd') };
}
function subagent(w, sid, id, model, ageMs) {
    const sub = path.join(w.proj, sid, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const file = path.join(sub, 'agent-' + id + '.jsonl');
    fs.writeFileSync(file, said(model));
    const t = (Date.now() - ageMs) / 1000;
    fs.utimesSync(file, t, t);
}
const ask = (w, toolInput) => prefixFor({ toolInput, pluginRoot: w.plugin, projectDir: w.projectDir,
    configDir: w.configDir, transcriptPath: w.transcriptPath, env: {} });

test('parseModel reads family and version off any claude id, with no table', () => {
    assert.deepEqual(parseModel('claude-sonnet-5-5'), { alias: 'sonnet', version: '5.5' });
    assert.deepEqual(parseModel('claude-sonnet-5'), { alias: 'sonnet', version: '5' });
    assert.deepEqual(parseModel('claude-haiku-5-5'), { alias: 'haiku', version: '5.5' });
    assert.deepEqual(parseModel('claude-haiku-4-5-20251001'), { alias: 'haiku', version: '4.5' });
    assert.equal(parseModel('<synthetic>'), null);
});

test('an agent file and a transcript give alias, version and effort', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet 5.5 · medium');
});

test('with no subagent transcript the version is left out', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet · medium');
});

test('tool_input.model wins over the frontmatter', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5-5', 1000);
    subagent(w, 's1', 'a2', 'claude-haiku-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', model: 'haiku', description: 'x' }), 'haiku 5.5 · medium');
});

test('the newest transcript names the version, not the most frequent', () => {
    const w = world();
    subagent(w, 's1', 'a1', 'claude-sonnet-5', 60000);
    subagent(w, 's1', 'a2', 'claude-sonnet-5', 50000);
    subagent(w, 's2', 'a3', 'claude-sonnet-5-5', 1000);
    assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', description: 'x' }), 'sonnet 5.5 · medium');
});

test('no model anywhere inherits the main transcript, effort inherit', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'general-purpose', description: 'x' }), 'opus 5.5 · inherit');
});

test('a user-level agent file is read when the project has none', () => {
    const w = world();
    fs.mkdirSync(path.join(w.configDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(w.configDir, 'agents', 'mine.md'), '---\nname: mine\nmodel: haiku\neffort: low\n---\n');
    assert.equal(ask(w, { subagent_type: 'mine', description: 'x' }), 'haiku · low');
});

test('retitle replaces a prefix the model wrote itself', () => {
    assert.equal(retitle('sonnet 5 · medium: survey stage agent', 'sonnet 5.5 · medium'), 'sonnet 5.5 · medium: survey stage agent');
    assert.equal(retitle('survey stage agent', 'sonnet · medium'), 'sonnet · medium: survey stage agent');
    assert.equal(retitle('inherit · inherit: x', 'opus 5.5 · inherit'), 'opus 5.5 · inherit: x');
});

test('a foreign plugin agent type is not titled: null', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'other-plugin:reviewer', description: 'x' }), null);
});

test('fankeel:<name> with no agent file is unreadable: null', () => {
    const w = world();
    assert.equal(ask(w, { subagent_type: 'fankeel:nonexistent', description: 'x' }), null);
});

test('a fankeel agent file that cannot be read is null', () => {
    const w = world();
    fs.mkdirSync(path.join(w.plugin, 'agents', 'broken.md'));
    assert.equal(ask(w, { subagent_type: 'fankeel:broken', description: 'x' }), null);
});

test('a readable agent file with no frontmatter block still inherits', () => {
    const w = world();
    fs.writeFileSync(path.join(w.plugin, 'agents', 'plain.md'), 'just a body\n');
    assert.equal(ask(w, { subagent_type: 'fankeel:plain', description: 'x' }), 'opus 5.5 · inherit');
});

test('built-ins, an unfound bare name and an empty type keep the inherit title', () => {
    const w = world();
    for (const t of ['general-purpose', 'Explore', 'Plan', 'no-such-agent', '', undefined]) {
        assert.equal(ask(w, { subagent_type: t, description: 'x' }), 'opus 5.5 · inherit', String(t));
    }
    assert.equal(ask(w, { description: 'x' }), 'opus 5.5 · inherit');
});
