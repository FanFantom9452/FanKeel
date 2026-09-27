// assets/station/tour-wizard.js — video 3, Setup wizard (1:00, 3600 frames):
// a 240-frame prelude, the eight steps 390 frames each, a 240-frame save.
// Every step asks a habit, a choice is pressed, and .fankeel/profile.json on
// the right gains the lines the station's wizard would write. The steps are
// assets/station/station.js WIZ_STEPS, in English; what each writes is what
// wizApply + wizChanges write on a fresh machine (tests/tour-wizard.test.js
// checks both). The storyboard is the `video-wizard` block of
// .fankeel/build/2026-09-27-tour/mockup.html; coordinates are its viewBox.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');

    var T0 = 240, STEP = 390, SAVE = 3360;

    // Step timing, in frames from the step's beat. Easings and durations are
    // the storyboard's: options expo-out 24 (6 apart), cursor expo-out 40,
    // press bounce-out 30, lines fly expo-out 36 (6 apart), green 60, exit
    // expo-in 12 from 378.
    //
    // Re-timed against the stills. The plan had one shape for all eight steps
    // (aim 30, press 80, fly 96, green after the last line lands); that leaves
    // the f 560 still with no green and the f 1500 still with nothing written,
    // where both stills show the new lines landed and flashing. So:
    // - step 1 keeps its 動 note's frames: press f 500 (local 260), lines fly
    //   f 520 (local 280); the f 300 still is the cursor arriving (aim 30).
    // - steps 2-8 are "一拍帶過" (wz-3's note): the cursor aims from local 10,
    //   presses at 34, lines fly from 54, so f 1500 (step 4, local 90) shows
    //   the pick pressed and stage.agents landing under the green, and f 2330
    //   (step 6, local 140) shows Balanced pressed and its note.
    // - the green starts as the first line lands (fly + 36), not the last, so
    //   a five-line array flashes while it is still settling, as wz-3 shows.
    // - the pick is outlined once the cursor is 97% there (aim + 20), which is
    //   what the f 300 still shows.
    var BASE = { opt: 6, optDur: 24, aimDur: 40, flyDur: 36, flyGap: 6, flash: 60, out: 378, outDur: 12 };
    function timing(n) {
        var t = {}, k;
        for (k in BASE) t[k] = BASE[k];
        if (n === 0) { t.aim = 30; t.press = 260; t.fly = 280; } else { t.aim = 10; t.press = 34; t.fly = 54; }
        return t;
    }

    // `writes` is write-vs-skip: station.js wizChanges (not wizApply) persists a key only when the pick differs from its builtin, so guard ask, sonnet · fable and station.hide false write nothing (the mockup's wz-4 and "11 keys" were placeholders).
    var STEPS = [
        { name: 'Finishing', q: ['How do you usually finish', 'a piece of work?'],
            opts: ['Merge locally', 'Open a PR', 'Keep the branch', 'Ask me each time'], pick: 0,
            keys: ['land.integration', 'land.push', 'land.archivePlan'],
            writes: [['land.integration', 'merge'], ['land.push', false], ['land.archivePlan', true]] },
        { name: 'Task size', q: ['How big are the tasks', 'you usually start?'],
            opts: ['Testing the water', 'A clear, bounded feature', 'Often touches the architecture', 'Decide per task'], pick: 1,
            keys: ['class.default'], writes: [['class.default', 'bounded']] },
        { name: 'Front end', q: ['How should this project\'s', 'mockups be drawn?'],
            opts: ['No front end', 'Yes, a quick sketch', 'Yes, drawn with care', 'Yes, the strongest model', 'Yes, drawn without asking'], pick: 2,
            keys: ['design.mockup', 'design.skill'], writes: [['design.mockup', 'opus']] },
        { name: 'Context', q: ['Mind the main session\'s', 'context filling up?'],
            opts: ['Run every stage here', 'Hand off survey', 'Hand off survey, build, verify', 'Hand off all seven'], pick: 2,
            keys: ['stage.agents'], writes: [['stage.agents', ['survey', 'build', 'verify']]] },
        { name: 'File clashes', q: ['Another session is editing', 'the same file. Then?'],
            opts: ['Ask me first', 'Block it', 'Just warn me'], pick: 0,
            keys: ['guard'], writes: [] },
        { name: 'Models', q: ['Money or quality, for', 'the agents you send?'],
            opts: ['Save money', 'Balanced', 'Quality first'], hints: ['haiku · opus', 'sonnet · fable', 'opus · fable'], pick: 1,
            keys: ['dispatch.floor', 'judge.model'], writes: [] },
        { name: 'Station', q: ['Show this project', 'on the station?'],
            opts: ['Yes, as usual', 'No, hide it'], pick: 0,
            keys: ['station.hide'], writes: [] },
        { name: 'Gate answers', q: ['Answer gates on', 'the web page?'],
            opts: ['No, in the terminal', 'Wait one minute', 'Wait five minutes'], pick: 1,
            keys: ['gate.station'], writes: [['gate.station', 60]] },
    ];
    var KEYS_WRITTEN = STEPS.reduce(function (a, s) { return a + s.writes.length; }, 0);

    function stepOf(f) { return f < T0 ? 0 : f >= SAVE ? 8 : Math.floor((f - T0) / STEP); }
    function optY(j) { return 112 + 42 * j; }
    function bez(p0, p1, p2, p3, t) { var u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }

    // profile.json as the video shows it after the first k steps: key order is
    // the order the steps wrote them; stage.agents one stage a line.
    function profileLines(k) {
        var pairs = [];
        STEPS.slice(0, k).forEach(function (s, i) {
            s.writes.forEach(function (w) { pairs.push({ key: w[0], value: w[1], step: i }); });
        });
        var out = [{ text: '{', step: -1 }];
        pairs.forEach(function (p, i) {
            var comma = i < pairs.length - 1 ? ',' : '';
            if (Array.isArray(p.value)) {
                out.push({ text: '  ' + JSON.stringify(p.key) + ': [', step: p.step });
                p.value.forEach(function (v, j) { out.push({ text: '    ' + JSON.stringify(v) + (j < p.value.length - 1 ? ',' : ''), step: p.step }); });
                out.push({ text: '  ]' + comma, step: p.step });
            } else out.push({ text: '  ' + JSON.stringify(p.key) + ': ' + JSON.stringify(p.value) + comma, step: p.step });
        });
        out.push({ text: '}', step: -1 });
        return out;
    }

    // The step rail: done steps a filled dot with a check, the current one
    // ringed with its number, the rest hollow; rows arrive top to bottom in the
    // prelude (expo-out 20, 8 apart).
    function rail(ctx, P, f) {
        var cur = stepOf(f);
        E.box(ctx, 16, 16, 140, 328, 8, P.panel);
        E.text(ctx, P, 't', 'Setup', 30, 42);
        E.text(ctx, P, 'j', Math.min(cur + 1, 8) + ' / 8', 142, 42, { align: 'right' });
        E.line(ctx, [[38, 72], [38, 296]], P.rule2, 1.5);
        STEPS.forEach(function (s, i) {
            var k = E.expoOut(E.prog(f, 20 + 8 * i, 20)), y = 76 + 31 * i;
            E.fade(ctx, k, function () {
                ctx.save();
                ctx.translate(0, -8 * (1 - k));
                if (i < cur) {
                    E.circle(ctx, 38, y, 9, P.ink2);
                    E.tick(ctx, 34, y, 0.6, 1, P.panel, 1.8);
                } else if (i === cur) {
                    E.circle(ctx, 38, y, 12, null, P.ink, 1.5);
                    E.circle(ctx, 38, y, 9, P.ink);
                    E.text(ctx, P, 'mi', String(i + 1), 38, y + 3.5, { size: 10.5, fill: P.panel, align: 'center' });
                } else {
                    E.circle(ctx, 38, y, 9, P.panel, P.rule2, 1.5);
                    E.text(ctx, P, 'mi', String(i + 1), 38, y + 3.5, { size: 10.5, fill: P.muted, align: 'center' });
                }
                E.text(ctx, P, 'b', s.name, 56, y + 4.5, i === cur ? { weight: '600' } : { fill: P.ink2 });
                ctx.restore();
            });
        });
    }

    function cursor(ctx, P, x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(4.2, 12.3);
        ctx.lineTo(7, 19);
        ctx.lineTo(9.6, 17.9);
        ctx.lineTo(6.8, 11.3);
        ctx.lineTo(12, 11.3);
        ctx.closePath();
        ctx.fillStyle = P.ink;
        ctx.fill();
        ctx.strokeStyle = P.ground;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    // One step's card: the question, the options (expo-out 24, 6 apart), the
    // cursor's approach, the press (0.96 → 1, bounce-out 30) with a check, and
    // the exit left (expo-in 12).
    function card(ctx, P, n, l) {
        var s = STEPS[n], L = timing(n), out = E.expoIn(E.prog(l, L.out, L.outDur));
        E.fade(ctx, 1 - out, function () {
            ctx.save();
            ctx.translate(-24 * out, 0);
            var h = E.expoOut(E.prog(l, 0, L.optDur));
            E.fade(ctx, h, function () {
                E.text(ctx, P, 'm', 'Step ' + (n + 1) + ' of 8', 172, 40);
                E.text(ctx, P, 't', s.q[0], 172, 68 + 8 * (1 - h), { size: 16 });
                E.text(ctx, P, 't', s.q[1], 172, 90 + 8 * (1 - h), { size: 16 });
            });
            var pressed = l >= L.press, pb = E.bounceOut(E.prog(l, L.press, 30)), ps = pressed ? E.lerp(0.96, 1, pb) : 1;
            s.opts.forEach(function (o, j) {
                var k = E.expoOut(E.prog(l, L.opt * (j + 1), L.optDur)), y = optY(j) + 10 * (1 - k), me = j === s.pick;
                E.fade(ctx, k, function () {
                    ctx.save();
                    if (me && pressed) {
                        ctx.translate(285, y + 17);
                        ctx.scale(ps, ps);
                        ctx.translate(-285, -(y + 17));
                        E.box(ctx, 172, y, 226, 34, 6, P.ink);
                    } else E.box(ctx, 172, y, 226, 34, 6, P.panel, me && l >= L.aim + 20 ? P.ink2 : null, 1.2);
                    E.text(ctx, P, 'b', o, 186, y + 22, me && pressed ? { fill: P.panel, weight: '600' } : pressed ? { fill: P.ink2 } : null);
                    if (s.hints) E.text(ctx, P, 'j', s.hints[j], 386, y + 22, { align: 'right', fill: me && pressed ? P.panel : P.muted });
                    else if (me && pressed) E.tick(ctx, 372, y + 12, 1, pb, P.panel);
                    ctx.restore();
                });
            });
            if (l >= L.aim) {
                var a = E.expoOut(E.prog(l, L.aim, L.aimDur)), ty = optY(s.pick) + 12;
                cursor(ctx, P, bez(372, 360, 340, 330, a), bez(300, 240, 180, ty, a));
            }
            ctx.restore();
        });
    }

    // The profile panel. A step's new lines fly in from its chosen option
    // (expo-out 36, 6 apart), flash green from the first landing and fade (60
    // frames); a step that writes nothing says so for 150 frames. After the
    // save the whole file turns from grey to bright (linear 30).
    function profile(ctx, P, f) {
        E.fade(ctx, E.expoOut(E.prog(f, 120, 24)), function () {
            E.box(ctx, 410, 16, 218, 328, 8, P.inset);
            E.text(ctx, P, 'j', '.fankeel/profile.json', 420, 40);
            E.line(ctx, [[410, 50], [628, 50]], P.rule2, 1.5);
            var n = stepOf(f), l = f - T0 - STEP * n, L = timing(n), flying = n < 8 && f >= T0 && l >= L.fly;
            var lines = profileLines(flying ? n + 1 : n), bright = f >= SAVE ? E.prog(f, SAVE + 30, 30) : 0;
            var first = -1, count = 0;
            lines.forEach(function (ln, i) {
                var y = 72 + 15 * i;
                if (flying && ln.step === n) {
                    if (first < 0) first = i;
                    var p = E.prog(l, L.fly + L.flyGap * count, L.flyDur), q = E.expoOut(p), sy = optY(STEPS[n].pick) + 22;
                    count++;
                    if (p > 0) E.text(ctx, P, 'jn', ln.text, E.lerp(398, 420, q), E.lerp(sy, y, q));
                    return;
                }
                E.text(ctx, P, 'j', ln.text, 420, y);
                E.fade(ctx, bright, function () { E.text(ctx, P, 'jn', ln.text, 420, y); });
            });
            if (first >= 0) {
                var landed = L.fly + L.flyDur;
                if (l >= landed) {
                    E.fade(ctx, 0.14 * (1 - E.prog(l, landed, L.flash)), function () {
                        E.box(ctx, 414, 72 + 15 * first - 12, 210, 15 * count + 2, 3, P.good);
                    });
                }
            }
            if (flying && !STEPS[n].writes.length) {
                var py = 72 + 15 * lines.length - 4;
                E.fade(ctx, E.expoOut(E.prog(l, L.fly, 24)) * (1 - E.prog(l, L.fly + 150, 30)), function () {
                    E.box(ctx, 420, py, 196, 22, 11, P.panel);
                    E.text(ctx, P, 's', 'built-in value · not written', 518, py + 15, { align: 'center' });
                });
            }
        });
    }

    // f 3360: the check draws (bounce-out 30) in its green disc, "Saved" rises
    // in (expo-out 24). Placed as the wz-5 still: disc and check at 288,120.
    function saved(ctx, P, s) {
        var c = E.bounceOut(E.prog(s, 0, 30));
        E.fade(ctx, 0.16 * c, function () { E.circle(ctx, 288, 120, 26 * c, P.good); });
        E.tick(ctx, 276, 120, 1.6, c, P.good, 3);
        var t = E.expoOut(E.prog(s, 12, 24));
        E.fade(ctx, t, function () {
            E.text(ctx, P, 'hc', 'Saved', 288, 186 + 12 * (1 - t), { align: 'center' });
            E.text(ctx, P, 'm', '.fankeel/profile.json', 288, 212, { align: 'center' });
            E.text(ctx, P, 's', STEPS.length + ' steps · ' + KEYS_WRITTEN + ' keys', 288, 234, { align: 'center' });
        });
    }

    function draw(ctx, f, P) {
        rail(ctx, P, f);
        profile(ctx, P, f);
        if (f >= SAVE) { saved(ctx, P, f - SAVE); return; }
        if (f >= T0) {
            var n = stepOf(f);
            card(ctx, P, n, f - T0 - STEP * n);
        }
    }

    var WIZARD = {
        length: 3600,
        beats: STEPS.map(function (s, i) { return { at: T0 + STEP * i, label: String(i + 1) }; }).concat([{ at: SAVE, label: 'saved' }]),
        stills: [300, 560, 1500, 2330, 3480],
        draw: draw,
    };
    E.register('wizard', WIZARD);

    module.exports = { WIZARD: WIZARD, STEPS: STEPS, profileLines: profileLines };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
