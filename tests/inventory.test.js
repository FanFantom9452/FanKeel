'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Hardcoded, not derived from the filesystem — an extra directory or an
// extra `.md` has to fail this test by name, not slide past it because
// the list was generated from the very thing being checked.
const SKILLS = [
    'fankeel',
    'fankeel-ask',
    'fankeel-audit',
    'fankeel-build',
    'fankeel-design',
    'fankeel-land',
    'fankeel-plan',
    'fankeel-survey',
    'fankeel-verify',
];

function setDiff(actual, expected) {
    const a = new Set(actual);
    const e = new Set(expected);
    return {
        extra: actual.filter((x) => !e.has(x)),
        missing: expected.filter((x) => !a.has(x)),
    };
}

test('skills/ holds exactly the known directories, sorted', () => {
    const actual = fs.readdirSync(path.join(ROOT, 'skills')).sort();
    const expected = [...SKILLS].sort();
    const { extra, missing } = setDiff(actual, expected);
    assert.deepEqual(actual, expected,
        'extra: ' + JSON.stringify(extra) + ', missing: ' + JSON.stringify(missing));
});

test('every listed skill directory has a SKILL.md', () => {
    for (const name of SKILLS) {
        const file = path.join(ROOT, 'skills', name, 'SKILL.md');
        assert.ok(fs.existsSync(file), name + ' has no SKILL.md');
    }
});

test('lib/stages.js exports NAMES, and every stage has its own skill directory', () => {
    const stages = require('../lib/stages.js');
    assert.ok(Array.isArray(stages.NAMES), 'lib/stages.js does not export NAMES as an array');
    assert.ok(stages.NAMES.length > 0, 'NAMES is empty');
    assert.ok(stages.NAMES.every((n) => typeof n === 'string'), 'NAMES holds something other than strings');
    const missing = stages.NAMES
        .map((stage) => 'fankeel-' + stage)
        .filter((dir) => !SKILLS.includes(dir));
    assert.deepEqual(missing, [], 'stage(s) with no skills/ directory: ' + JSON.stringify(missing));
});

test('hooks/*.js matches exactly what plugin.json references', () => {
    // plugin.json is the source of truth for which hooks run. A
    // hooks/hooks.json would be a second one, and there is none today —
    // if this ever exists, read the hook list from there instead.
    assert.ok(!fs.existsSync(path.join(ROOT, 'hooks', 'hooks.json')),
        'hooks/hooks.json exists now — read the hook list from there, not from plugin.json');

    const hookFiles = fs.readdirSync(path.join(ROOT, 'hooks'))
        .filter((f) => f.endsWith('.js'))
        .sort();

    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const referenced = new Set();
    const RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([\w.-]+\.js)/g;
    for (const matchers of Object.values(manifest.hooks)) {
        for (const matcher of matchers) {
            for (const hook of matcher.hooks) {
                let m;
                RE.lastIndex = 0;
                while ((m = RE.exec(hook.command))) referenced.add(m[1]);
            }
        }
    }
    const referencedSorted = [...referenced].sort();
    const { extra, missing } = setDiff(hookFiles, referencedSorted);
    assert.deepEqual(hookFiles, referencedSorted,
        'extra hook file(s): ' + JSON.stringify(extra) + ', missing hook file(s): ' + JSON.stringify(missing));
});
