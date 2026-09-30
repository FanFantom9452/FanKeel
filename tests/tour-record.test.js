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
const { parseArgs, ffmpegPath, ffprobeOf, ffmpegArgs, scoreWav, devtoolsPort, countFrames, audioStreams } = require('../scripts/tour-record.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'tour-record.js');

// Criterion: --lang zh|en picks the language, zh by default, one file per
// language. Red when: --lang is refused as unknown, or both languages write
// the same file.
test('parseArgs takes one timeline name, --lang zh|en (zh unless given) and an optional --out', () => {
    assert.deepEqual(parseArgs(['reel', '--out', 'x.mp4']), { name: 'reel', lang: 'zh', out: path.resolve('x.mp4') });
    assert.deepEqual(parseArgs(['reel']), { name: 'reel', lang: 'zh', out: path.resolve('.fankeel', 'build', 'tour', 'reel-zh.mp4') });
    assert.deepEqual(parseArgs(['reel', '--lang', 'en']), { name: 'reel', lang: 'en', out: path.resolve('.fankeel', 'build', 'tour', 'reel-en.mp4') });
});

test('a wrong name, a wrong language, no name or a stray flag exits 2', () => {
    const bad = spawnSync(process.execPath, [SCRIPT, 'intro'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /usage: tour-record\.js <reel\|promo30\|promo30v3\|promo30v4> \[--lang zh\|en\] \[--out f\.mp4\]/);
    const lang = spawnSync(process.execPath, [SCRIPT, 'reel', '--lang', 'fr'], { encoding: 'utf8' });
    assert.equal(lang.status, 2);
    assert.match(lang.stderr, /usage: tour-record\.js/);
    const none = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(none.status, 2);
    const flag = spawnSync(process.execPath, [SCRIPT, 'reel', '--fps', '30'], { encoding: 'utf8' });
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
    const r = spawnSync(process.execPath, [SCRIPT, 'reel'], { encoding: 'utf8', env });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /PATH/);
    assert.match(r.stderr, /FANKEEL_FFMPEG/);
});

test('ffprobe sits beside ffmpeg; the encoder reads PNGs from stdin at 60 fps', () => {
    assert.equal(ffprobeOf(path.join('C:', 'ff', 'ffmpeg.exe')), path.join('C:', 'ff', 'ffprobe.exe'));
    assert.equal(ffprobeOf('/usr/bin/ffmpeg'), path.join('/usr/bin', 'ffprobe'));
    const a = ffmpegArgs('out.mp4', 'out.wav');
    assert.deepEqual(a.slice(a.indexOf('-f'), a.indexOf('-f') + 2), ['-f', 'image2pipe']);
    assert.equal(a[a.indexOf('-framerate') + 1], '60');
    assert.equal(a[a.indexOf('-i') + 1], '-');
    assert.equal(a.at(-1), 'out.mp4');
});

// Criterion: the MP4 carries the score as AAC, cut to the picture. Red when:
// the WAV is never handed to ffmpeg, or no audio codec is named.
test('the score goes in as a second input, encoded AAC, and the shorter stream ends the file', () => {
    const a = ffmpegArgs('out.mp4', 'out.wav');
    assert.deepEqual(a.map((x, i) => (x === '-i' ? a[i + 1] : null)).filter(Boolean), ['-', 'out.wav']);
    assert.equal(a[a.indexOf('-c:a') + 1], 'aac');
    assert.ok(a.includes('-shortest'));
    assert.deepEqual(a.filter((x, i) => a[i - 1] === '-map'), ['0:v', '1:a']);
});

test('scoreWav is the promo\'s score as a 60-second mono WAV', () => {
    const b = scoreWav('reel');
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt32LE(40), 60 * 44100 * 2);
});

test('audioStreams is null when ffprobe cannot run', () => {
    assert.equal(audioStreams(path.join(tmp('fankeel-tour-probe-a-'), 'ffprobe-missing'), 'x.mp4'), null);
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

test('promo30 is a timeline name, and its score is a 30-second WAV', () => {
    assert.deepEqual(parseArgs(['promo30']), { name: 'promo30', lang: 'zh', out: path.resolve('.fankeel', 'build', 'tour', 'promo30-zh.mp4') });
    const b = scoreWav('promo30');
    assert.equal(b.readUInt32LE(40), 30 * 44100 * 2);
});

// red when: 'promo30v3' is dropped from NAMES in scripts/tour-record.js (parseArgs exits with usage)
test('promo30v3 is a timeline name', () => {
    assert.deepEqual(parseArgs(['promo30v3']), { name: 'promo30v3', lang: 'zh', out: path.resolve('.fankeel', 'build', 'tour', 'promo30v3-zh.mp4') });
});

// red when: scoreWav stops requiring tour-ring.js (E.get('promo30v3') is undefined), or scores promo30v3 at another length than promo30's
test('promo30v3 score is a 30-second WAV, the same length as promo30', () => {
    const b = scoreWav('promo30v3');
    assert.equal(b.readUInt32LE(40), 30 * 44100 * 2);
    assert.equal(b.length, scoreWav('promo30').length);
});

// red when: 'promo30v4' is dropped from NAMES in scripts/tour-record.js (parseArgs exits with usage)
test('promo30v4 is a timeline name', () => {
    assert.deepEqual(parseArgs(['promo30v4']), { name: 'promo30v4', lang: 'zh', out: path.resolve('.fankeel', 'build', 'tour', 'promo30v4-zh.mp4') });
});

// red when: scoreWav scores promo30v4 at another length than 60 seconds (the v4 timeline length changes, or the score ignores it)
test('promo30v4 score is a 60-second WAV', () => {
    const b = scoreWav('promo30v4');
    assert.equal(b.readUInt32LE(40), 60 * 44100 * 2);
});

// red when: 'promo30v5' is dropped from NAMES in scripts/tour-record.js (parseArgs exits with usage), or its timeline stops being 4440 frames / 74 s (the score is cut to it)
test('promo30v5 is a timeline name of 4440 frames, and its score is a 74-second WAV', () => {
    assert.equal(parseArgs(['promo30v5']).name, 'promo30v5');
    assert.equal(require('../assets/station/tour.js').length('promo30v5'), 4440);
    assert.equal(scoreWav('promo30v5').readUInt32LE(40), 74 * 44100 * 2);
});

// red when: promo30v5's default output leaves F:/ymlab/fankeel-videos/v5/ (V5_DIR changes), FANKEEL_VIDEOS_V5 stops overriding it, or another name starts writing there
test('promo30v5 writes to F:/ymlab/fankeel-videos/v5/ by default; the others keep .fankeel/build/tour', () => {
    const was = process.env.FANKEEL_VIDEOS_V5;
    delete process.env.FANKEEL_VIDEOS_V5;
    try {
        assert.equal(parseArgs(['promo30v5']).out, path.resolve('F:/ymlab/fankeel-videos/v5', 'promo30v5-zh.mp4'));
        assert.equal(parseArgs(['promo30v5', '--lang', 'en']).out, path.resolve('F:/ymlab/fankeel-videos/v5', 'promo30v5-en.mp4'));
        assert.equal(parseArgs(['promo30v4']).out, path.resolve('.fankeel', 'build', 'tour', 'promo30v4-zh.mp4'));
        process.env.FANKEEL_VIDEOS_V5 = path.resolve('elsewhere');
        assert.equal(parseArgs(['promo30v5']).out, path.resolve('elsewhere', 'promo30v5-zh.mp4'));
    } finally {
        if (was === undefined) delete process.env.FANKEEL_VIDEOS_V5; else process.env.FANKEEL_VIDEOS_V5 = was;
    }
});

// The usage regex in the first test stays on the four-name line; v5 keeps its
// own line, so folding it in would change what that test pins.
// red when: the usage text loses promo30v5's own line (its name, or the directory it records to)
test('the usage text has a promo30v5 line that says where its MP4 goes', () => {
    const bad = spawnSync(process.execPath, [SCRIPT, 'intro'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /tour-record\.js promo30v5 \[--lang zh\|en\] \[--out f\.mp4\]\s+\(MP4 in F:\/ymlab\/fankeel-videos\/v5\)/);
});

// record() needs a browser and ffmpeg (the artefact step), so the delete is
// read from the source: the guarded rmSync of the score's .wav sits in the
// `finally` (every exit, error or not), after child.kill() and inside its own
// try/catch, so a wav ffmpeg still holds cannot mask the original error.
// red when: the rmSync is removed, loses its wav && args.name === 'promo30v5' guard, is added for another path, moves out of finally, moves before child.kill(), or loses its try/catch
test('only promo30v5 deletes its .wav, on every exit', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.equal(src.match(/rmSync\(wav/g).length, 1);
    const fin = src.indexOf('} finally {');
    assert.ok(fin > 0, 'no finally block');
    const tail = src.slice(fin, src.indexOf('async function main'));
    const m = /try \{\s*if \(wav && args\.name === 'promo30v5'\) fs\.rmSync\(wav, \{ force: true \}\);\s*\} catch \(e\) \{/.exec(tail);
    assert.ok(m, 'no guarded, try-wrapped rmSync of the wav inside finally');
    assert.ok(tail.indexOf('child.kill()') >= 0 && tail.indexOf('child.kill()') < m.index, 'the delete must follow child.kill()');
});
