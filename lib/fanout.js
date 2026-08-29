'use strict';

// The nested repositories of one walk, read concurrently.
//
// It is a separate process rather than a promise because `trackedFiles` is
// synchronous and six callers read it that way — and three of their entry
// points fail silently rather than loudly if that stops being true:
// `scripts/layout.js` exits before a promise settles, and `scripts/orient.js`
// and `scripts/survey.js` print `[object Promise]`. One `execFileSync` onto
// this file buys the concurrency without any of them learning about it.
//
// It lives in `lib/` and not `scripts/` because `lib/tracked.js` is what spawns
// it, and nothing in `lib/` may reach into `scripts/` — the constraint named at
// the top of that file as the reason it exists at all.

const cp = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');

const execFile = promisify(cp.execFile);

// Where the curve flattens. Measured over thirty repositories, median of three
// runs: 1279ms serial, then 634 at two, 376 at four, 306 at six, 293 at eight,
// and 283 from twelve upwards. Past eight the gain is inside the noise and
// every extra process is a real one, so eight is where it stops.
const WIDTH = 8;

const ARGS = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];

// One repository, with the same `--stage`-then-retry that `gitList` does. A git
// too old to take `--stage` beside `--others` refuses the whole call rather
// than the flag, so the retry drops it; the second failure is the real one and
// answers nothing, which is what `gitFiles` returns for the same case.
async function one(dir) {
    for (const staged of [true, false]) {
        try {
            const { stdout } = await execFile('git', staged ? ARGS.concat('--stage') : ARGS, {
                cwd: dir,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
            });
            return { out: stdout, staged };
        } catch (e) {
            // Asking a directory that is not a repository is a normal step
            // here, not an error, and the caller reads `null` as that answer.
        }
    }
    return null;
}

// A bounded pool rather than `Promise.all` over the whole list. The measured
// difference between the two is inside the noise, but the list is however many
// repositories somebody happens to have, and eight at once is a number this
// chose rather than one it was handed.
async function fanout(root, repos, width) {
    const out = {};
    const queue = repos.slice();
    const workers = Math.min(width || WIDTH, queue.length);
    await Promise.all(Array.from({ length: workers }, async () => {
        for (;;) {
            const sub = queue.shift();
            if (sub === undefined) return;
            out[sub] = await one(path.join(root, sub));
        }
    }));
    return out;
}

module.exports = { fanout };

// The only part of this file that touches stdio, and the reason it is four
// statements: `fanout` above is the logic, and it is what the tests call.
if (require.main === module) {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => {
        let input;
        // Nothing readable on stdin answers nothing, and the caller reads that
        // as every repository unanswered — which sends it back to reading them
        // serially rather than leaving it with a list it cannot explain.
        try { input = JSON.parse(raw); } catch (e) { input = null; }
        // `JSON.parse('null')` succeeds, so the catch above is not the whole
        // guard: what has to hold is that there is an object with a list of
        // repositories on it.
        if (!input || !Array.isArray(input.repos)) { process.stdout.write('{}'); return; }
        fanout(input.root, input.repos)
            .then((out) => process.stdout.write(JSON.stringify(out)))
            .catch(() => process.stdout.write('{}'));
    });
}
