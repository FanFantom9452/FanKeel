'use strict';
// scripts/tour-record.js without a browser: the argument parser, where ffmpeg
// comes from and what the script says when there is none, the ffmpeg and
// ffprobe command lines, and the DevTools port read off the browser's stderr.
// The recording itself is the artefact step of the plan, not a unit test: it
// needs a browser and ffmpeg and takes minutes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, devtoolsPort, countFrames } = require('../scripts/tour-record.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'tour-record.js');

test('parseArgs takes one timeline name and an optional --out', () => {
    assert.deepEqual(parseArgs(['stages', '--out', 'x.mp4']), { name: 'stages', out: path.resolve('x.mp4') });
    assert.deepEqual(parseArgs(['stages']), { name: 'stages', out: path.resolve('.fankeel', 'build', 'tour', 'stages.mp4') });
});

test('a wrong name, no name or a stray flag exits 2', () => {
    const bad = spawnSync(process.execPath, [SCRIPT, 'intro'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /usage: tour-record\.js <stages> \[--out f\.mp4\]/);
    const none = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(none.status, 2);
    const flag = spawnSync(process.execPath, [SCRIPT, 'stages', '--fps', '30'], { encoding: 'utf8' });
    assert.equal(flag.status, 2);
    assert.match(flag.stderr, /tour-record: unknown argument --fps/);
});

test('ffmpegPath: FANKEEL_FFMPEG first, then PATH, else null', () => {
    const dir = tmp('fankeel-tour-ff-');
    const exe = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    fs.writeFileSync(exe, '');
    const other = path.join(tmp('fankeel-tour-ff2-'), 'my-ffmpeg');
    fs.writeFileSync(other, '');
    assert.equal(ffmpegPath({ FANKEEL_FFMPEG: other, PATH: dir }), other);
    assert.equal(ffmpegPath({ PATH: dir }), exe);
    assert.equal(ffmpegPath({ Path: dir }), exe);
    assert.equal(ffmpegPath({ PATH: tmp('fankeel-tour-empty-') }), null);
    assert.equal(ffmpegPath({ FANKEEL_FFMPEG: path.join(dir, 'missing.exe'), PATH: dir }), null);
});

test('with no ffmpeg the script stops before any browser and names both places', () => {
    const env = { PATH: tmp('fankeel-tour-nopath-'), SystemRoot: process.env.SystemRoot || '' };
    const r = spawnSync(process.execPath, [SCRIPT, 'stages'], { encoding: 'utf8', env });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /PATH/);
    assert.match(r.stderr, /FANKEEL_FFMPEG/);
});

test('ffprobe sits beside ffmpeg; the encoder reads PNGs from stdin at 60 fps', () => {
    assert.equal(ffprobeOf(path.join('C:', 'ff', 'ffmpeg.exe')), path.join('C:', 'ff', 'ffprobe.exe'));
    assert.equal(ffprobeOf('/usr/bin/ffmpeg'), path.join('/usr/bin', 'ffprobe'));
    const a = ffmpegArgs('out.mp4');
    assert.deepEqual(a.slice(a.indexOf('-f'), a.indexOf('-f') + 2), ['-f', 'image2pipe']);
    assert.equal(a[a.indexOf('-framerate') + 1], '60');
    assert.equal(a[a.indexOf('-i') + 1], '-');
    assert.equal(a.at(-1), 'out.mp4');
});

test('the DevTools port comes off the browser\'s stderr line', () => {
    assert.equal(devtoolsPort('\nDevTools listening on ws://127.0.0.1:53817/devtools/browser/0b1c\n'), 53817);
    assert.equal(devtoolsPort('nothing yet'), null);
});

test('countFrames is null when ffprobe cannot run', () => {
    assert.equal(countFrames(path.join(tmp('fankeel-tour-probe-'), 'ffprobe-missing'), 'x.mp4'), null);
});

test('countFrames is null when ffprobe runs, exits nonzero, but prints a number anyway', (t) => {
    // A fixture that genuinely runs (not a missing path) is the only way to
    // exercise `if (r.status !== 0) return null;` on line 69 of
    // scripts/tour-record.js: it must actually execute, exit nonzero, AND put
    // a parseable integer on stdout, so the guard is what makes the
    // difference and not a NaN from a process that never launched.
    const dir = tmp('fankeel-tour-probe-exec-');
    let fake;
    if (process.platform === 'win32') {
        // .cmd/.bat can no longer be spawned directly without `shell: true`
        // (Node's fix for CVE-2024-27980) — spawnSync(ffprobe, args) here has
        // no shell, so a batch file fixture would just fail to launch and
        // give the same "never ran" result as the test above. A real PE
        // executable is required instead; compile one with the C# compiler
        // that ships with the .NET Framework on Windows.
        const csc = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
        if (!fs.existsSync(csc)) { t.skip('no C# compiler available to build a genuinely executable fake ffprobe'); return; }
        fake = path.join(dir, 'ffprobe.exe');
        const src = path.join(dir, 'fake-ffprobe.cs');
        fs.writeFileSync(src, 'class FakeFfprobe { static int Main(string[] a) { System.Console.Write("42"); return 3; } }\n');
        const built = spawnSync(csc, ['/nologo', '/out:' + fake, src], { encoding: 'utf8' });
        assert.equal(built.status, 0, 'csc.exe failed: ' + built.stdout + built.stderr);
    } else {
        fake = path.join(dir, 'ffprobe');
        fs.writeFileSync(fake, '#!/bin/sh\necho 42\nexit 3\n');
        fs.chmodSync(fake, 0o755);
    }
    assert.equal(countFrames(fake, 'x.mp4'), null);
});
