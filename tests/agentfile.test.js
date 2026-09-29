'use strict';

// station-6: `profile set agent.<name>.model|effort` writes a copy of the
// plugin's agent file with those two lines changed and a `generated_by` mark,
// where Claude Code resolves the bare name: the project's `.claude/agents/`,
// or with `--default` the config directory's `agents/`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const { PLUGIN_ROOT, agentKey, agentNames, generatedVersion, syncAgent, refresh } = require('../lib/agentfile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
const PLUGIN_READER = fs.readFileSync(path.join(PLUGIN_ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
const bodyOf = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    return execFileSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', cwd: d, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('agent.<name>.model takes the dispatch.floor list, .effort the five efforts, and only a plugin agent name', () => {
    assert.equal(profile.parseValue('agent.fankeel-reader.model', ' Haiku ').value, 'haiku');
    assert.equal(profile.parseValue('agent.fankeel-reader.effort', 'xhigh').value, 'xhigh');
    assert.match(profile.parseValue('agent.fankeel-reader.model', 'gpt').error, /is one of: sonnet, opus, fable, haiku/);
    assert.match(profile.parseValue('agent.fankeel-reader.effort', 'huge').error, /is one of: low, medium, high, xhigh, max/);
    assert.match(profile.parseValue('agent.fankeel-nope.model', 'haiku').error, /fankeel-reader/);
    assert.deepEqual(agentKey('agent.fankeel-reader.effort'), { name: 'fankeel-reader', field: 'effort' });
    assert.equal(agentKey('agent.fankeel-reader.tools'), null);
    assert.ok(agentNames(PLUGIN_ROOT).includes('fankeel-brain'));
});

test('profile set agent.fankeel-reader.model haiku writes the project override; clearing both keys removes it', () => {
    const d = tmp('fankeel-agentfile-');
    const file = path.join(d, '.claude', 'agents', 'fankeel-reader.md');
    assert.match(cli(d, 'set', 'agent.fankeel-reader.model', 'haiku'), /agent file: written/);
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^model: haiku$/m);
    assert.match(text, /^effort: medium$/m, 'the effort line stays the plugin\'s when only the model is set');
    assert.equal(generatedVersion(text), VERSION);
    assert.equal(bodyOf(text), bodyOf(PLUGIN_READER), 'the body is the plugin file verbatim');
    cli(d, 'set', 'agent.fankeel-reader.effort', 'high');
    assert.match(fs.readFileSync(file, 'utf8'), /^effort: high$/m);
    cli(d, 'unset', 'agent.fankeel-reader.model');
    assert.ok(fs.existsSync(file), 'one key is still set');
    assert.match(cli(d, 'unset', 'agent.fankeel-reader.effort'), /agent file: removed/);
    assert.equal(fs.existsSync(file), false);
});

test('--default writes under the config directory, not the project', () => {
    const d = tmp('fankeel-agentfile-');
    cli(d, 'set', 'agent.fankeel-reviewer.effort', 'max', '--default');
    assert.match(fs.readFileSync(path.join(d, 'cfg', 'agents', 'fankeel-reviewer.md'), 'utf8'), /^effort: max$/m);
    assert.equal(fs.existsSync(path.join(d, '.claude', 'agents', 'fankeel-reviewer.md')), false);
});

test('a same-name file with no generated_by line is somebody\'s own: neither overwritten nor removed', () => {
    const d = tmp('fankeel-agentfile-');
    const file = path.join(d, '.claude', 'agents', 'fankeel-reader.md');
    const mine = '---\nname: fankeel-reader\nmodel: opus\n---\nmine\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, mine);
    assert.match(cli(d, 'set', 'agent.fankeel-reader.model', 'haiku'), /agent file: left alone/);
    assert.equal(fs.readFileSync(file, 'utf8'), mine);
    cli(d, 'unset', 'agent.fankeel-reader.model');
    assert.equal(fs.readFileSync(file, 'utf8'), mine);
});

test('refresh rewrites a marked file from another version and leaves a current one alone', () => {
    const d = tmp('fankeel-agentfile-');
    const profileFile = profile.projectFile(d);
    fs.mkdirSync(path.dirname(profileFile), { recursive: true });
    fs.writeFileSync(profileFile, JSON.stringify({ 'agent.fankeel-reader.model': 'haiku' }));
    const agentsDir = path.join(d, '.claude', 'agents');
    const file = path.join(agentsDir, 'fankeel-reader.md');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(file, '---\nname: fankeel-reader\nmodel: haiku\ngenerated_by: fankeel 0.0.1\n---\nold body\n');
    const targets = [{ profileFile, agentsDir }];
    assert.deepEqual(refresh({ pluginRoot: PLUGIN_ROOT, version: VERSION, targets }), [file]);
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(generatedVersion(text), VERSION);
    assert.equal(bodyOf(text), bodyOf(PLUGIN_READER));
    assert.deepEqual(refresh({ pluginRoot: PLUGIN_ROOT, version: VERSION, targets }), [], 'already at this version');
    assert.equal(syncAgent({ pluginRoot: PLUGIN_ROOT, profileFile, agentsDir, name: 'fankeel-brain', version: VERSION }).state, 'absent');
});
