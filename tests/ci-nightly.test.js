'use strict';
// assets/ci/nightly.yml (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §3):
// a Gitea Actions schedule that runs suite.json's nightly tier through
// `node <plugin>/scripts/suite.js --nightly` — no session, no record (group A)
// — and that fankeel itself never writes into a project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const text = fs.readFileSync(path.join(ROOT, 'assets', 'ci', 'nightly.yml'), 'utf8');

test('the template is a schedule with a manual trigger and no secrets', () => {
    assert.match(text, /^on:\r?\n {2}schedule:\r?\n {4}- cron: "0 18 \* \* \*"/m);
    assert.match(text, /^ {2}workflow_dispatch:/m);
    assert.doesNotMatch(text, /secrets\./);
    assert.match(text, /fankeel never writes this file into a project/);
});

test('the template fetches fankeel and runs suite.js --nightly with no session', () => {
    assert.match(text, /git clone --depth 1 https:\/\/github\.com\/FanFantom9452\/FanKeel\.git "\$RUNNER_TEMP\/fankeel"/);
    assert.match(text, /^ {8}run: node "\$RUNNER_TEMP\/fankeel\/scripts\/suite\.js" --nightly$/m);
    assert.doesNotMatch(text, /--session/);
});

test('no code in lib, scripts or hooks names the template, so nothing copies it', () => {
    for (const sub of ['lib', 'scripts', 'hooks']) {
        for (const f of fs.readdirSync(path.join(ROOT, sub))) {
            const p = path.join(ROOT, sub, f);
            if (fs.statSync(p).isFile()) assert.ok(!fs.readFileSync(p, 'utf8').includes('nightly.yml'), sub + '/' + f);
        }
    }
});
