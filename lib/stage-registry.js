'use strict';

// The pure logic behind scripts/stage-registry.js: every stage's rules
// reduced to what another tool can check without parsing prose — the
// sentence that gates entry to its skill, the sentence that gates leaving
// it, and how many of its own budgeted bytes the injected block actually
// spends today.
//
// Sized at a reference plugin root rather than this checkout's, for the
// same reason tests/render.test.js does at its own REFERENCE_ROOT: the real
// output grows by wherever fankeel happens to be installed, and a number
// that moved with the install path would never deep-equal between two
// checkouts of the same commit. `budget` in lib/stages.js is set against the
// same reference, which is what makes `prompt_bytes <= prompt_byte_budget`
// mean anything.

const fs = require('node:fs');
const path = require('node:path');
const { NAMES, byName } = require('./stages.js');
const { render, PLUGIN_ROOT } = require('./render.js');

const REFERENCE_ROOT = 59;

const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const FULL_ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

// The worst case tests/render.test.js's own cap test measures against: every
// `when` rule crossed both ways, because the profile that turns one on is
// also the one that binds against the cap.
const PROFILES = [true, false].flatMap((archive) => [false, 'opus'].map((mockup) => ({
    values: { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': archive, guard: 'ask', 'dispatch.floor': 'sonnet', 'judge.model': 'fable', 'design.mockup': mockup },
})));

function entryFor(stage) {
    return {
        mine: { sessionId: MINE, data: { task: 'rework the colour ramp', claims: ['statusline.ps1', 'statusline.sh'], stage, class: 'architectural', route: FULL_ROUTE, active: true, started: ago(2 * 3600e3), updated: ago(60e3) } },
        others: [], now: NOW,
    };
}

// `render()` names its own PLUGIN_ROOT from where lib/render.js itself sits
// on disk, not from whatever `root` this function is called with — the two
// only coincide because this registry is always about fankeel's own stages,
// never a project the plugin is pointed at. Importing the same constant
// `render()` uses, rather than recomputing one from `root`, is what keeps
// that true even if a future caller passes a `root` that does not happen to
// be this checkout.
function bytesAtReference(out) {
    const roots = out.split(PLUGIN_ROOT).length - 1;
    return Buffer.byteLength(out, 'utf8') + roots * (REFERENCE_ROOT - PLUGIN_ROOT.length);
}

// The worst of the four profile crossings, in UTF-8 bytes at a 59-character
// root — the same figure `build`'s `budget` in lib/stages.js is pinned to.
function promptBytes(stage) {
    let worst = 0;
    for (const profile of PROFILES) {
        const out = render(Object.assign({ profile }, entryFor(stage)));
        const size = bytesAtReference(out);
        if (size > worst) worst = size;
    }
    return worst;
}

// The tail of the rule that reads `Read the fankeel-<stage> skill on entry:
// ...` — every stage carries exactly one, checked by
// tests/stages.test.js's own coverage of that rule.
function entryCondition(stage) {
    const re = new RegExp('^Read the fankeel-' + stage + ' skill on entry:\\s*(.+)$');
    for (const rule of byName(stage).rules) {
        const m = re.exec(rule);
        if (m) return m[1].trim();
    }
    return null;
}

// The first sentence of the `**Done when**` paragraph, without the markdown
// bold markers. Stops at the first period followed by a capital letter,
// `*` or a backtick — every stage's inline code (`` `skipped:` ``,
// `` `TODO.md` ``) contains no period-then-space, so none of those false-
// trigger the boundary.
function stopCondition(root, stage) {
    const file = path.join(root, 'skills', 'fankeel-' + stage, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    const m = /\*\*Done when\*\*\s+([\s\S]+?\.)\s+[A-Z*`]/.exec(text);
    return m ? ('Done when ' + m[1].replace(/\s+/g, ' ')) : null;
}

function buildRegistry(root) {
    const stages = NAMES.map((name) => {
        const stage = byName(name);
        const entry_condition = entryCondition(name);
        const stop_condition = stopCondition(root, name);
        if (!entry_condition) throw new Error(name + ' names no "Read the fankeel-' + name + ' skill on entry:" rule');
        if (!stop_condition) throw new Error('skills/fankeel-' + name + '/SKILL.md carries no "**Done when**" sentence');
        if (typeof stage.budget !== 'number') throw new Error(name + ' has no budget in lib/stages.js');
        return {
            name,
            entry_condition,
            stop_condition,
            prompt_bytes: promptBytes(name),
            prompt_byte_budget: stage.budget,
        };
    });
    return { generated_by: 'scripts/stage-registry.js', stages };
}

module.exports = { buildRegistry };
