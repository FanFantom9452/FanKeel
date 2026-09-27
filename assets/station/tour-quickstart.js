// assets/station/tour-quickstart.js — video 1, Quick start (0:30, 1800 frames).
// Type /fankeel, pick a task, watch the statusline, answer a gate with the
// first option, arrive at land. The storyboard is the `video-quickstart`
// block of .fankeel/build/2026-09-27-tour/mockup.html; coordinates are its
// 640x360 viewBox. Numbers come from tourEngine.SESSION. The menu's task
// names are made up, as the storyboard says: no session's task text is drawn.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var S = E.SESSION;

    var CMD = '/fankeel';
    var TASKS = ['Add CSV export to the report page', 'Fix the flaky login test', 'Type something else'];
    var TASK_LINES = [['b', TASKS[0], 56, 108], ['m', 'reading .fankeel/map.md', 72, 134], ['m', '3 readers running', 72, 156]];
    var GATE = ['Approve and move to plan', 'Change the approach', 'Stop the task'];
    var GATE_Y = [156, 198, 238];
    var LANDED = (S.land.integration === 'merge' ? 'merged locally' : S.land.integration) + ' · ' + (S.land.push ? 'pushed' : 'not pushed');
    var WAITED = E.ROUTE.reduce(function (a, s) { return a + S.waited[s]; }, 0);

    // Every event, as a frame. Beats start at 240, 600, 1020 and 1500.
    // Re-timed inside the land beat: the f 1620 still's 動 note starts the
    // counters at 1590, but with expo-out 45 they would end at 1635, after the
    // still and inside the "last 180 frames are still" the same note asks for.
    // countAt is 1575 so they read final at 1620; the "merged locally" line
    // (no start in the note) fades in from 1596 so it too is whole by 1620.
    var EV = {
        typeFrom: 30, perChar: 6, menuIn: 240, menuPop: 24, hlMove: 300, hlDur: 18, menuOut: 400, outDur: 12,
        lines: [432, 456, 480], chipIn: 510, chipDur: 20,
        zoom: 600, zoomDur: 36, timerDur: 90, dotAt: 690, dotDur: 20, zoomOut: 1008,
        gate: 1020, cardDur: 24, waitFrom: 1040, waitDur: 60, hl: 1100, hlDur2: 18, tick: 1128, tickDur: 30, gateOut: 1488,
        land: 1500, perStage: 12, barsAt: 1560, barsDur: 40, countAt: 1575, countDur: 45, noteAt: 1596
    };

    // The statusline chip: 8 units a character, dots 20 to its right.
    function chip(ctx, P, stage) {
        var label = '[FANKEEL:' + stage.toUpperCase() + ']', c = P.st[stage];
        E.box(ctx, 52, 308, 8 * label.length, 20, 4, null, c, 1.2);
        E.text(ctx, P, 'mi', label, 60, 322, { size: 12, fill: c });
        return 52 + 8 * label.length + 20;
    }
    function status(ctx, P, stage, at, pop) {
        var x0 = chip(ctx, P, stage);
        E.dots(ctx, P, x0, 17, 318, 4, at, pop);
        E.text(ctx, P, 'm', Math.min(at + 1, 7) + '/7', x0 + 116, 322);
    }

    function terminal(ctx, P, f) {
        E.box(ctx, 36, 22, 568, 316, 10, P.panel);
        E.text(ctx, P, 's', 'claude', 56, 46);
        var n = Math.max(0, Math.min(CMD.length, Math.floor((f - EV.typeFrom) / EV.perChar) + 1));
        var typed = '> ' + CMD.slice(0, n), done = f >= EV.menuOut;
        E.text(ctx, P, done ? 'm' : 'mi', typed, 56, 80);
        var typedEnd = EV.typeFrom + CMD.length * EV.perChar;
        if (!done && (f < typedEnd + 30 || Math.floor(f / 30) % 2 === 1)) {
            ctx.fillStyle = P.ink;
            ctx.fillRect(56 + ctx.measureText(typed).width + 4, 68, 8, 15);
        }
        TASK_LINES.forEach(function (l, i) {
            var a = E.expoOut(E.prog(f, EV.lines[i], 18));
            E.fade(ctx, a, function () { E.text(ctx, P, l[0], l[1], l[2], l[3] + 6 * (1 - a)); });
        });
        E.line(ctx, [[36, 300], [604, 300]], P.rule2, 1.5);
    }

    // f 240 the menu pops (back-out 24, 0.92 → 1); f 300 the highlight slides
    // from row 2 to row 1 (expo-out 18); f 400 it leaves (expo-in 12).
    function menu(ctx, P, f) {
        var inP = E.prog(f, EV.menuIn, EV.menuPop), outP = E.prog(f, EV.menuOut, EV.outDur);
        if (inP <= 0 || outP >= 1) return;
        var s = E.lerp(0.92, 1, E.backOut(inP));
        E.fade(ctx, E.expoOut(inP) * (1 - E.expoIn(outP)), function () {
            ctx.save();
            ctx.translate(260, 180);
            ctx.scale(s, s);
            ctx.translate(-260, -180);
            E.box(ctx, 56, 100, 408, 160, 8, P.inset);
            E.text(ctx, P, 't', 'Which task?', 74, 128);
            var hy = E.lerp(180, 144, E.expoOut(E.prog(f, EV.hlMove, EV.hlDur)));
            E.box(ctx, 66, hy, 388, 30, 5, P.rule);
            TASKS.forEach(function (t, i) {
                var y = 164 + 36 * i, on = Math.abs(hy - (144 + 36 * i)) < 18;
                E.text(ctx, P, on ? 'mi' : 'm', String(i + 1), 80, y);
                E.text(ctx, P, 'b', t, 102, y, on ? null : { fill: P.ink2 });
            });
            ctx.restore();
        });
    }

    // f 600 the camera opens the statusline 2.2x (expo-out 36) while the
    // terminal dims to 32%; the timer runs 0s → 6m22s (expo-out 90); f 690 the
    // first route dot lights and rings (back-out 20).
    function zoom(ctx, P, f) {
        var z = E.expoOut(E.prog(f, EV.zoom, EV.zoomDur));
        E.fade(ctx, E.lerp(1, 0.32, z), function () { terminal(ctx, P, f); chip(ctx, P, 'survey'); });
        var x = E.lerp(52, 70, z), y = E.lerp(308, 196, z), w = E.lerp(128, 500, z), h = E.lerp(20, 72, z);
        E.fade(ctx, z, function () {
            E.line(ctx, [[52, 308], [x, y]], P.faint, 1, [3, 4]);
            E.line(ctx, [[180, 308], [x + w, y]], P.faint, 1, [3, 4]);
        });
        E.box(ctx, x, y, w, h, E.lerp(4, 12, z), P.panel, P.rule2, 1.2);
        E.fade(ctx, E.expoOut(E.prog(f, EV.zoom + 18, 18)), function () {
            var c = P.st.survey;
            E.box(ctx, 90, 216, 222, 32, 6, null, c, 1.6);
            E.text(ctx, P, 'mi', '[FANKEEL:SURVEY]', 102, 238, { size: 19, fill: c });
            E.dots(ctx, P, 340, 20, 232, 6, f >= EV.dotAt ? 0 : -1, E.backOut(E.prog(f, EV.dotAt, EV.dotDur)));
            E.text(ctx, P, 'big', E.fmtClock(S.clock.survey * E.expoOut(E.prog(f, EV.zoom, EV.timerDur))), 552, 240, { align: 'right' });
        });
    }

    // f 1020 the gate card rises 24 units (back-out 24); "waited" runs to
    // 3m21s (expo-out 60); f 1100 the highlight lands on option 1; f 1128 the
    // check draws (bounce-out 30, one rebound).
    function gate(ctx, P, f) {
        E.box(ctx, 36, 22, 568, 316, 10, P.panel);
        E.text(ctx, P, 's', 'claude', 56, 46);
        var k = E.prog(f, EV.gate, EV.cardDur);
        E.fade(ctx, E.expoOut(k), function () {
            ctx.save();
            ctx.translate(0, 24 * (1 - E.backOut(k)));
            E.box(ctx, 56, 62, 528, 222, 8, P.inset);
            E.text(ctx, P, 't', 'Approve this design?', 76, 94);
            E.text(ctx, P, 's', 'One approach, a mockup, and a check that can fail.', 76, 116);
            var h = E.expoOut(E.prog(f, EV.hl, EV.hlDur2));
            E.fade(ctx, h, function () { E.box(ctx, 68, 134, 504, 34, 6, P.rule); });
            GATE.forEach(function (o, i) {
                E.text(ctx, P, i === 0 && h > 0.5 ? 'mi' : 'm', String(i + 1), 84, GATE_Y[i]);
                E.text(ctx, P, 'b', o, 106, GATE_Y[i], i === 0 ? null : { fill: P.ink2 });
            });
            E.tick(ctx, 544, 151, 1, E.bounceOut(E.prog(f, EV.tick, EV.tickDur)), P.good);
            E.text(ctx, P, 'm', 'waited ' + E.fmtClock(S.waited.design * E.expoOut(E.prog(f, EV.waitFrom, EV.waitDur))), 568, 272, { align: 'right' });
            ctx.restore();
        });
        E.line(ctx, [[36, 300], [604, 300]], P.rule2, 1.5);
        status(ctx, P, 'design', 1, 1);
    }

    // f 1500 the dots light plan → land, 12 frames a stop (back-out 20);
    // f 1560 the bars grow (expo-out 40); f 1575 the four numbers count up
    // (expo-out 45; the note says 1590, see EV); the last 180 frames are still.
    function land(ctx, P, f) {
        E.box(ctx, 36, 22, 568, 316, 10, P.panel);
        var t = E.expoOut(E.prog(f, EV.land, 24));
        E.fade(ctx, t, function () { E.text(ctx, P, 'hc', 'Route complete', 320, 82 + 8 * (1 - t), { align: 'center' }); });
        E.bars(ctx, P, 80, 112, 480, 20, 152, E.expoOut(E.prog(f, EV.barsAt, EV.barsDur)));
        if (f >= EV.countAt) {
            var c = E.expoOut(E.prog(f, EV.countAt, EV.countDur));
            E.stats(ctx, P, [[140, E.fmtSpan(S.total * c), 'start to land'], [260, E.fmtUsd(S.usd * c), 'spent'],
                [380, String(Math.round(S.agents * c)), 'agents'], [500, E.fmtSpan(WAITED * c), 'waited on you']], 210, 232);
        }
        E.fade(ctx, E.expoOut(E.prog(f, EV.noteAt, 24)), function () { E.text(ctx, P, 'm', LANDED, 320, 272, { align: 'center' }); });
        E.line(ctx, [[36, 300], [604, 300]], P.rule2, 1.5);
        var at = Math.min(7, 2 + Math.floor((f - EV.land) / EV.perStage));
        status(ctx, P, E.ROUTE[Math.min(at, 6)], at, at < 7 ? E.backOut(E.prog(f, EV.land + EV.perStage * (at - 2), 20)) : 1);
    }

    function draw(ctx, f, P) {
        if (f < EV.zoom) {
            terminal(ctx, P, f);
            menu(ctx, P, f);
            E.fade(ctx, E.expoOut(E.prog(f, EV.chipIn, EV.chipDur)), function () { chip(ctx, P, 'survey'); });
            return;
        }
        if (f < EV.gate) { E.fade(ctx, 1 - E.expoIn(E.prog(f, EV.zoomOut, 12)), function () { zoom(ctx, P, f); }); return; }
        if (f < EV.land) { E.fade(ctx, 1 - E.expoIn(E.prog(f, EV.gateOut, 12)), function () { gate(ctx, P, f); }); return; }
        land(ctx, P, f);
    }

    var QUICKSTART = {
        length: 1800,
        beats: [
            { at: 240, label: 'pick' },
            { at: 600, label: 'survey', stage: 'survey' },
            { at: 1020, label: 'gate', stage: 'design' },
            { at: 1500, label: 'land', stage: 'land' }
        ],
        stills: [330, 720, 1140, 1620],
        draw: draw
    };
    E.register('quickstart', QUICKSTART);

    module.exports = { QUICKSTART: QUICKSTART };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
