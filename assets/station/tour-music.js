// assets/station/tour-music.js — the promo's score, as data, and the
// synthesiser that turns it into sound: mono Float32 PCM at 44100 Hz, the
// same samples in the browser (tour-player.js hands them to Web Audio) and in
// Node (scripts/tour-record.js writes them to a WAV). No audio file is kept in
// the repository and nothing is imported: every voice is a formula of time.
//
// 120 BPM in 4/4 at 60 fps: a beat is 30 frames = 22050 samples, a bar 120
// frames = 88200. Frame f starts at sample f × 735. The score reads the
// timeline's cues — `cuts`, the frame each cut starts on, and `blocks`, the
// frame each document block rises on — so the sound lands where the picture
// moves. Bright plucks: a whoosh into every cut and a hit on it, a pluck per
// block, the lead from the route cut (bar 3) on, and the last bar resolved on
// the tonic, faded out over its second half.
(function (root, module) {
    'use strict';

    var RATE = 44100, FPS = 60, BPM = 120;
    var PER_FRAME = RATE / FPS; // 735
    var BEAT = RATE * 60 / BPM; // 22050
    var BAR = BEAT * 4; // 88200

    // The score. Bars count from 0; bar 2 (frame 240) is the drop; the
    // resolve bar is resolveBar(frames), 28 (frame 3360) at the default 3600
    // frames, 13 at 1800.
    var CHORDS = {
        C: { root: 36, tones: [60, 64, 67] },
        G: { root: 43, tones: [59, 62, 67] },
        Am: { root: 45, tones: [57, 60, 64] },
        F: { root: 41, tones: [57, 60, 65] },
    };
    var CYCLE = ['C', 'G', 'Am', 'F'];
    var DROP = 2;
    // The resolve is two bars from the end: bar 28 of reel's 30, bar 13 of
    // promo30's 15. A bar is 120 frames.
    function resolveBar(frames) { return frames / 120 - 2; }
    function chordAt(bar, resolve) {
        if (bar < DROP) return CHORDS[['C', 'Am'][bar]];
        if (bar < resolve) return CHORDS[CYCLE[(bar - DROP) % 4]];
        return CHORDS.C;
    }
    // The lead: eight eighth-notes a bar, as indexes into the chord's tones
    // an octave up (3 is the root two octaves up).
    var LEAD = [0, 2, 1, 3, 2, 1, 0, 2];

    function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    // A fixed-seed noise source, so two renders are the same samples.
    function noise(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6d2b79f5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
        };
    }

    function add(out, at, n, fn) {
        var end = Math.min(out.length, at + n);
        for (var i = Math.max(0, at); i < end; i++) out[i] += fn((i - at) / RATE);
    }

    // The voices. Each adds itself into `out` from sample `at`.
    function pluck(out, at, f, gain) {
        add(out, at, Math.round(0.6 * RATE), function (t) {
            var s = 0;
            for (var h = 1; h <= 4; h++) s += Math.sin(2 * Math.PI * f * h * t) * Math.exp(-t * (6 + 5 * h)) / h;
            return gain * s * Math.min(1, t * 400);
        });
    }
    function kick(out, at, gain) {
        add(out, at, Math.round(0.25 * RATE), function (t) {
            var ph = 2 * Math.PI * (50 * t + (100 / 30) * (1 - Math.exp(-30 * t)));
            return gain * Math.sin(ph) * Math.exp(-9 * t);
        });
    }
    function hat(out, at, gain, rnd) {
        add(out, at, Math.round(0.06 * RATE), function (t) { return gain * rnd() * Math.exp(-60 * t); });
    }
    function bass(out, at, f, gain, len) {
        add(out, at, len, function (t) {
            var tri = 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * f * t));
            return gain * tri * Math.exp(-4 * t) * Math.min(1, t * 200);
        });
    }
    function pad(out, at, tones, gain, len) {
        add(out, at, len, function (t) {
            var env = Math.min(1, t / 0.3) * Math.min(1, (len / RATE - t) / 0.1);
            var s = 0;
            tones.forEach(function (m) {
                var f = hz(m);
                s += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t);
            });
            return gain * env * s / tones.length;
        });
    }
    // The whoosh: filtered noise rising over the 12 frames before a cut and
    // stopping on it.
    function whoosh(out, cut, gain, rnd) {
        var n = 12 * PER_FRAME, at = cut - n, lp = 0;
        for (var i = 0; i < n; i++) {
            if (at + i < 0) { rnd(); continue; }
            var p = i / n, a = 0.02 + 0.3 * p * p;
            lp += a * (rnd() - lp);
            out[at + i] += gain * p * p * lp;
        }
    }
    // The hit on a cut: a low boom and a noise burst, both short.
    function hit(out, at, gain, rnd) {
        add(out, at, Math.round(0.3 * RATE), function (t) {
            return gain * (0.8 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-10 * t) + 0.5 * rnd() * Math.exp(-25 * t));
        });
    }

    // cues = { cuts: [frame], blocks: [frame] }; frames is the timeline's
    // length, reel's 3600 unless given. Returns frames * 735 samples, peak at
    // most 0.9.
    function render(cues, frames) {
        frames = frames || 3600;
        var LENGTH = Math.round(frames * PER_FRAME), RESOLVE = resolveBar(frames);
        var out = new Float32Array(LENGTH), rnd = noise(9452);
        var frame = function (f) { return Math.round(f * PER_FRAME); };
        var bars = LENGTH / BAR;
        for (var b = 0; b < bars; b++) {
            var at = b * BAR, ch = chordAt(b, RESOLVE);
            if (b >= DROP) pad(out, at, ch.tones, 0.05, b >= RESOLVE ? LENGTH - at : BAR);
            if (b >= DROP && b < RESOLVE) {
                for (var k = 0; k < 4; k++) kick(out, at + k * BEAT, 0.45);
                for (k = 0; k < 4; k++) hat(out, at + k * BEAT + BEAT / 2, 0.05, rnd);
                for (k = 0; k < 8; k++) bass(out, at + k * BEAT / 2, hz(ch.root), 0.18, BEAT / 2);
                for (k = 0; k < 8; k++) {
                    var i = LEAD[k], m = i === 3 ? ch.tones[0] + 24 : ch.tones[i] + 12;
                    pluck(out, at + k * BEAT / 2, hz(m), 0.06);
                }
            }
            if (b === RESOLVE) {
                bass(out, at, hz(ch.root), 0.22, LENGTH - at);
                ch.tones.forEach(function (m) { pluck(out, at, hz(m + 12), 0.12); });
            }
        }
        var cuts = (cues && cues.cuts) || [];
        var blocks = (cues && cues.blocks) || [];
        cuts.forEach(function (c) {
            whoosh(out, frame(c), 0.25, rnd);
            hit(out, frame(c), 0.9, rnd);
        });
        // A pluck per block, a step up the chord for each block of the same
        // cut, so a page that fills climbs.
        blocks.forEach(function (f) {
            var cut = 0;
            cuts.forEach(function (c) { if (c <= f) cut = c; });
            var n = blocks.filter(function (g) { return g >= cut && g < f; }).length;
            var tones = chordAt(Math.floor(f / 120), RESOLVE).tones;
            pluck(out, frame(f), hz(tones[n % 3] + 12 * (1 + Math.floor(n / 3) % 2)), 0.2);
        });
        var peak = 0;
        for (var j = 0; j < LENGTH; j++) peak = Math.max(peak, Math.abs(out[j]));
        var g = peak > 0.9 ? 0.9 / peak : 1;
        var fade = BAR / 2;
        for (j = 0; j < LENGTH; j++) {
            var r = j >= LENGTH - fade ? (LENGTH - j) / fade : 1;
            out[j] *= g * r;
        }
        return out;
    }

    // 16-bit PCM WAV, mono, RATE Hz: the bytes scripts/tour-record.js hands
    // to ffmpeg. A Uint8Array, so the same function runs in a page.
    function wav(pcm) {
        var n = pcm.length, bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
        var str = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        str(0, 'RIFF');
        v.setUint32(4, 36 + n * 2, true);
        str(8, 'WAVE');
        str(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, RATE, true);
        v.setUint32(28, RATE * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        str(36, 'data');
        v.setUint32(40, n * 2, true);
        for (var i = 0; i < n; i++) {
            var s = Math.max(-1, Math.min(1, pcm[i]));
            v.setInt16(44 + i * 2, Math.round(s * 32767), true);
        }
        return bytes;
    }

    module.exports = { RATE: RATE, render: render, resolveBar: resolveBar, wav: wav };
    if (typeof window !== 'undefined') root.tourMusic = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
