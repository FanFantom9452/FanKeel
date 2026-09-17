'use strict';

// Which of this session's stages already have a competing "how to do this
// step" skill installed from another plugin, so `orient` can name the
// collision once instead of every run finding out the hard way.
//
// `OVERLAPS` is the table N27 asks for: known collisions between a
// superpowers skill and a fankeel stage, kept here rather than duplicated
// in `docs/pipeline.md`, which points at this module as the one to trust.
const fs = require('node:fs');
const path = require('node:path');

const OVERLAPS = [
    { plugin: 'superpowers', skill: 'brainstorming', stage: 'design' },
    { plugin: 'superpowers', skill: 'writing-plans', stage: 'plan' },
    { plugin: 'superpowers', skill: 'executing-plans', stage: 'build' },
    { plugin: 'superpowers', skill: 'subagent-driven-development', stage: 'build' },
    { plugin: 'superpowers', skill: 'verification-before-completion', stage: 'verify' },
    { plugin: 'superpowers', skill: 'finishing-a-development-branch', stage: 'land' },
];

// The rows whose plugin is actually installed under `configDir` and whose
// skill file is really there — not every row the table lists. A plugin's
// installs are keyed `<name>@<marketplace>`, so the name is read off the
// part before the `@` rather than matched against the whole key, and every
// scope (user, project, ...) that name is installed under is checked in
// turn: the first one whose `installPath` holds the skill file is enough
// to report the row.
//
// A missing or unparsable `installed_plugins.json` is not an error — most
// machines running this plugin have never heard of the other one — so it
// answers `[]` the same way `docs.read()` answers an empty tree for a
// repository with no `docs.json`.
function overlapsIn(configDir) {
    const file = path.join(String(configDir == null ? '' : configDir), 'plugins', 'installed_plugins.json');
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
    const plugins = data && typeof data === 'object' ? data.plugins : null;
    if (!plugins || typeof plugins !== 'object') return [];

    const installsByName = new Map();
    for (const key of Object.keys(plugins)) {
        const name = String(key).split('@')[0];
        const list = Array.isArray(plugins[key]) ? plugins[key] : [];
        if (!installsByName.has(name)) installsByName.set(name, []);
        installsByName.get(name).push(...list);
    }

    return OVERLAPS.filter((row) => {
        const installs = installsByName.get(row.plugin) || [];
        return installs.some((inst) => {
            const installPath = inst && typeof inst.installPath === 'string' ? inst.installPath : '';
            if (!installPath) return false;
            try {
                return fs.statSync(path.join(installPath, 'skills', row.skill, 'SKILL.md')).isFile();
            } catch (e) {
                return false;
            }
        });
    });
}

module.exports = { OVERLAPS, overlapsIn };
