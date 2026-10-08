'use strict';

// Every test file that needs a scratch directory takes one from here. Node's
// test runner gives each file its own process, so one exit handler per file
// removes every directory that file made — and a file that crashes still runs
// it, which is the case that mattered: 957,746 directories had accumulated
// under %TEMP% by 2026-09-07, none of them removed by anything.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const made = [];

// force, so a directory already gone is not an error; recursive, because these
// hold whole fixture trees; and each in its own try, so one directory a child
// process still holds open cannot strand the rest.
process.on('exit', () => {
  for (const dir of made) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // Nothing useful to do at exit. The next `npm run clean` gets it.
    }
  }
});

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

// The options object lib/bench.js selftest takes: it reads its scratch-directory
// maker from the key named below, so the name lives here and nowhere else.
tmp.selfOpts = (plugin) => ({ mkdtemp: () => tmp('fankeel-bench-self-'), plugin });

module.exports = tmp;
