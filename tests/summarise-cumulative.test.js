'use strict';
// docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js:
// `--resume` gives `total_cost_usd` and `modelUsage` cumulative since the
// session's own start, so summing them across stage files double- (or
// n-tuple-) counts. The real total is whichever stage comes last, read once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence',
    '2026-09-25-controller-multiplier', 'summarise.js');

function write(dir, name, totalUsd, model, u) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ total_cost_usd: totalUsd, modelUsage: { [model]: u } }));
}

test("summarise.js's arm() reads only the last stage's cumulative total, not a sum across stages", () => {
    const dir = tmp('fankeel-summarise-');
    write(dir, 'opus-design.json', 1.00, 'claude-opus-5-5',
        { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 100, cacheCreationInputTokens: 20, costUSD: 1.00 });
    write(dir, 'opus-verify.json', 3.00, 'claude-opus-5-5',
        { inputTokens: 30, outputTokens: 15, cacheReadInputTokens: 300, cacheCreationInputTokens: 60, costUSD: 3.00 });
    write(dir, 'sonnet-design.json', 2.00, 'claude-sonnet-5',
        { inputTokens: 8, outputTokens: 4, cacheReadInputTokens: 80, cacheCreationInputTokens: 16, costUSD: 2.00 });
    write(dir, 'sonnet-verify.json', 5.00, 'claude-sonnet-5',
        { inputTokens: 24, outputTokens: 12, cacheReadInputTokens: 240, cacheCreationInputTokens: 48, costUSD: 5.00 });
    const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
    assert.equal(out.arms.opus.usd, 3.00, 'verify is the last stage; its own total is already cumulative, not design+verify summed to 4.00');
    assert.equal(out.arms.sonnet.usd, 5.00);
    assert.equal(out.arms.opus.models['claude-opus-5-5'].usd, 3.00);
    assert.equal(out.arms.opus.tokens, 30 + 15 + 300 + 60);
});
