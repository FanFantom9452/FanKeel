// assets/station/tour-reel.js — the kinetic promo (1:00, 3600 frames = 30
// bars at 120 BPM), the `reel` timeline: hook 0–239, logo 240–479, route
// 480–719, the seven stages 240 frames each from 720 (tour-reel-stages.js),
// clash 2400–2759, numbers 2760–3119, outro 3120–3599 — every shot starting
// on a bar line, something moving on every beat. This file puts all thirteen
// shots end to end, registers the timeline, and hands the score
// (tour-music.js, unchanged) its cues: the frame each shot starts on and the
// frame each thing lands on.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var K = root.tourReelKit || require('./tour-reel-kit.js');
    var ST = root.tourReelStages || require('./tour-reel-stages.js');
    var t = K.t;
    var CX = E.W / 2, CY = E.H / 2;

    // hook (0–239): a card a beat drops onto a tower that sways more the
    // higher it gets; at 180 it topples, at 210 已過時 is stamped over it.
    var PILE = ['getStock()', 'export.csv', 'retry x3', 'schedule.md', 'report.md', 'README.md'];
    function hook(ctx, P, l) {
        K.field(ctx, P, l);
        var sh = K.shake(l, 210, 9), fall = E.expoIn(E.prog(l, 180, 36));
        ctx.save();
        ctx.translate(sh[0], sh[1]);
        K.popText(ctx, P, 'cap', t(P, 'hook.cap'), CX, 52, 560, l, 0, { size: 26, from: 1.8, lines: 1 });
        ctx.save();
        ctx.translate(CX - 80, 318);
        ctx.rotate(0.012 * Math.sin(l * 0.14) * Math.min(l, 180) / 30 + fall * 0.9);
        PILE.forEach(function (n, i) {
            var at = i * 30, k = E.bounceOut(E.prog(l, at, 16));
            if (!(k > 0)) return;
            var y = -30 - i * 34 - (1 - k) * 260 - fall * i * 16, x = 80 + (K.rnd(i) - 0.5) * 30 + fall * i * 22;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((K.rnd(i + 5) - 0.5) * 0.12 + fall * i * 0.15);
            E.box(ctx, -78, -14, 156, 28, 6, P.panel, E.ROUTE[i] ? P.st[E.ROUTE[i]] : P.rule2, 1.5);
            E.text(ctx, P, 'nm', n, 0, 4, { align: 'center', fill: P.ink });
            ctx.restore();
        });
        ctx.restore();
        var st = E.prog(l, 210, 10);
        if (st > 0) {
            E.fade(ctx, 0.35 * K.decay(l, 210, 6), function () { ctx.fillStyle = P.bad; ctx.fillRect(-20, -20, E.W + 40, E.H + 40); });
            ctx.save();
            ctx.translate(CX, 214);
            ctx.rotate(-0.16);
            ctx.scale(E.lerp(3, 1, E.expoOut(st)), E.lerp(3, 1, E.expoOut(st)));
            E.box(ctx, -96, -34, 192, 68, 8, K.hex(P.bad, 0.16), P.bad, 4);
            E.fitText(ctx, P, 'cap', t(P, 'hook.stale'), 0, 0, 170, { align: 'center', middle: true, size: 40, weight: '800', fill: P.bad, lines: 1 });
            ctx.restore();
        }
        ctx.restore();
    }

    // logo (240–479): seven stripes slam in to fill the frame, squeeze into
    // a seven-colour bar under the name, the name rises letter by letter and
    // bursts at 90; the line at 150; a push in at the end.
    function logo(ctx, P, l) {
        var h = E.H / 7, sq = K.inOut(E.prog(l, 44, 40)), push = E.expoIn(E.prog(l, 214, 26));
        ctx.save();
        ctx.translate(CX, CY);
        ctx.scale(1 + push * 1.4, 1 + push * 1.4);
        ctx.translate(-CX, -CY);
        if (sq > 0.5) K.field(ctx, P, l);
        E.ROUTE.forEach(function (s, i) {
            var k = E.expoOut(E.prog(l, i * 5, 18)), dir = i % 2 ? 1 : -1;
            var x = E.lerp(0, 180 + i * 40, sq) + dir * (1 - k) * E.W, y = E.lerp(i * h, 226, sq);
            var w = E.lerp(E.W, 38, sq), hh = E.lerp(h + 0.5, 6, sq);
            E.box(ctx, x, y, w, hh, 3 * sq, P.st[s]);
        });
        var breathe = 1 + 0.012 * Math.sin(l * 0.1);
        ctx.save();
        ctx.translate(CX, 196);
        ctx.scale(breathe, breathe);
        K.word(ctx, P, 'fankeel', 0, 0, 84, l, 72, { align: 'center', gap: 3 });
        ctx.restore();
        K.ring(ctx, CX, 170, 330, P.ink, l, 90, 40, 4);
        K.burst(ctx, P, CX, 170, l, 90, 28, 3);
        K.wipeText(ctx, P, 'cap', t(P, 'logo.tag'), CX, 282, 520, l, 150, { align: 'center', middle: true, len: 24, lines: 1 });
        ctx.restore();
        E.fade(ctx, push, function () { ctx.fillStyle = P.ground; ctx.fillRect(0, 0, E.W, E.H); });
    }

    // route (480–719): a line draws across, lighting a stage a beat with its
    // name and its one line under it; the camera drifts in, and from 200
    // dives into survey, whose colour floods the frame.
    var NX = 50, NS = 90, NY = 176;
    function route(ctx, P, l) {
        var dive = E.expoIn(E.prog(l, 196, 44)), zoom = 1 + 0.06 * E.prog(l, 0, 196) + dive * 7;
        ctx.save();
        ctx.translate(NX, NY);
        ctx.scale(zoom, zoom);
        ctx.translate(-NX + (1 - dive) * (-3 + l * 0.02), -NY);
        K.field(ctx, P, l + 480);
        K.popText(ctx, P, 'cap', t(P, 'route.h'), CX, 70, 520, l, 0, { size: 28, lines: 1 });
        var head = NX + Math.min(l, 180) * 3;
        E.line(ctx, [[NX, NY], [head, NY]], P.rule2, 4);
        E.ROUTE.forEach(function (s, i) {
            var at = i * 30, x = NX + i * NS, k = E.backOut(E.prog(l, at, 14));
            if (!(k > 0)) return;
            E.circle(ctx, x, NY, 11 * k, P.st[s]);
            K.ring(ctx, x, NY, 40, P.st[s], l, at, 24, 3);
            E.fade(ctx, E.prog(l, at + 4, 10), function () {
                E.text(ctx, P, 'mi', s, x, NY + 36 - (1 - E.expoOut(E.prog(l, at + 4, 14))) * 10, { align: 'center', fill: P.st[s] });
                E.fitText(ctx, P, 's', t(P, 'what.' + s), x, NY + 58, 86, { align: 'center', fill: P.ink2 });
            });
        });
        ctx.restore();
        K.flood(ctx, l, 240, NX + (1 - dive) * 0, NY, P.st.survey);
    }

    // clash (2400–2759): two sessions come at one file from either side and
    // meet on it at 120 — a flash, a shake, a red pulse a beat until 240,
    // 同一個檔 over it and the line under it; a pull back at the end.
    function clash(ctx, P, l) {
        var sh = K.shake(l, 120, 10), back = E.expoIn(E.prog(l, 330, 30));
        K.field(ctx, P, l);
        ctx.save();
        ctx.translate(CX + sh[0], 160 + sh[1]);
        ctx.scale(1 - back * 0.6, 1 - back * 0.6);
        ctx.rotate(back * 0.3);
        var hitk = l >= 120;
        [120, 150, 180, 210, 240].forEach(function (at) { K.ring(ctx, 0, 0, 150, P.bad, l, at, 34, 3); });
        var k = E.backOut(E.prog(l, 0, 18));
        ctx.save();
        ctx.scale(k, k);
        E.box(ctx, -66, -40, 132, 80, 10, hitk ? K.hex(P.bad, 0.14) : P.panel, hitk ? P.bad : P.rule2, 2);
        E.text(ctx, P, 'mi', 'stock.js', 0, 6, { align: 'center', fill: P.ink, size: 16 });
        ctx.restore();
        [[-1, P.st.design, 'session A'], [1, P.st.audit, 'session B']].forEach(function (s) {
            var p = K.inOut(E.prog(l, 10, 110)), x = s[0] * E.lerp(330, 110, p), y = Math.sin(p * Math.PI * 2) * 40 * s[0] + (hitk ? 0 : 0);
            var rec = hitk ? s[0] * 14 * K.decay(l, 120, 10) : 0;
            ctx.save();
            ctx.translate(x + rec, y);
            E.box(ctx, -52, -26, 104, 52, 10, P.panel, s[1], 2);
            E.text(ctx, P, 'nm', s[2], 0, -6, { align: 'center', fill: s[1] });
            E.fitText(ctx, P, 's', t(P, 'clash.editing'), 0, 12, 90, { align: 'center', middle: true, fill: P.ink2 });
            ctx.restore();
        });
        K.popText(ctx, P, 'pill', t(P, 'clash.same'), 0, -66, 150, l, 130, { fill: P.bad, from: 2.6 });
        ctx.restore();
        E.fade(ctx, 0.5 * K.decay(l, 120, 5), function () { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, E.W, E.H); });
        E.fade(ctx, 1 - back, function () { K.wipeText(ctx, P, 'cap', t(P, 'clash.cap'), CX, 300, 580, l, 150, { align: 'center', middle: true, len: 26 }); });
    }

    // numbers (2760–3119): one real session in four counters, a column a
    // beat pair from 0, each rolling up to its number; they fall away at 330.
    function numbers(ctx, P, l) {
        var S = E.SESSION;
        var COLS = [
            [7, function (v) { return String(Math.round(v)); }, 'num.stages', P.st.survey],
            [S.agents, function (v) { return String(Math.round(v)); }, 'num.agents', P.st.build],
            [S.usd, function (v) { return E.fmtUsd(v); }, 'num.usd', P.st.design],
            [S.total, function (v) { return E.fmtSpan(v); }, 'num.time', P.st.verify],
        ];
        K.field(ctx, P, l + 2760);
        K.wipeText(ctx, P, 'cap', t(P, 'num.h'), CX, 70, 560, l, 0, { align: 'center', middle: true, lines: 1 });
        COLS.forEach(function (c, i) {
            var at = i * 60, x = 92 + i * 152, k = E.backOut(E.prog(l, at, 18)), roll = E.expoOut(E.prog(l, at, 50));
            var drop = E.expoIn(E.prog(l, 322 + i * 4, 30));
            if (!(k > 0)) return;
            ctx.save();
            ctx.translate(x, 190 + (1 - k) * 80 + drop * 260);
            ctx.rotate(drop * (i - 1.5) * 0.3);
            E.box(ctx, -66, -74, 132, 4 + 144 * E.expoOut(E.prog(l, at + 4, 22)), 10, K.hex(c[3], 0.1));
            E.box(ctx, -66, -74, 132, 4, 2, c[3]);
            var jitter = roll < 1 ? Math.sin(l * 2.1) * 3 * (1 - roll) : 0;
            E.text(ctx, P, 'big', c[1](c[0] * roll), 0, -4 + jitter, { align: 'center', size: i > 1 ? 30 : 46, fill: P.ink });
            E.fade(ctx, E.prog(l, at + 10, 12), function () { E.fitText(ctx, P, 's', t(P, c[2]), 0, 40, 118, { align: 'center', middle: true, fill: P.ink2 }); });
            ctx.restore();
            if (i === 1) {
                for (var d = 0; d < S.agents; d++) {
                    var dk = E.backOut(E.prog(l, at + 10 + d, 10));
                    if (dk > 0) E.circle(ctx, x - 55 + (d % 14) * 8.5, 246 + Math.floor(d / 14) * 8 + drop * 260, 2.2 * dk, c[3]);
                }
            }
        });
    }

    // outro (3120–3599): the two install lines typed into a box at 0 and 60,
    // the tagline wiped in at 120 as the box drops, and on the resolve (240)
    // the name rising over its seven-colour bar with a burst.
    var CMDS = ['claude plugin marketplace add FanFantom9452/FanKeel', 'claude plugin install fankeel@fankeel'];
    function outro(ctx, P, l) {
        K.field(ctx, P, l + 3120);
        var down = K.inOut(E.prog(l, 120, 30)), lock = E.prog(l, 240, 1);
        var by = E.lerp(170, 300, down), bs = E.lerp(1, 0.8, down);
        E.fade(ctx, 1 - down, function () { K.wipeText(ctx, P, 'h', t(P, 'outro.two'), CX, 76, 520, l, 0, { align: 'center', middle: true, lines: 1 }); });
        ctx.save();
        ctx.translate(CX, by);
        ctx.scale(bs * E.backOut(E.prog(l, 0, 16)), bs * E.backOut(E.prog(l, 0, 16)));
        E.box(ctx, -250, -40, 500, 80, 10, P.panel, P.rule2, 1.5);
        CMDS.forEach(function (c, i) {
            var n = Math.max(0, Math.min(c.length, Math.floor((l - 8 - i * 60) / 1.1)));
            var y = -8 + i * 26;
            E.text(ctx, P, 'code', '$', -230, y, { fill: P.good });
            E.text(ctx, P, 'code', c.slice(0, n), -214, y, { size: 13 });
            if (n < c.length && n > 0 || i === 1 && n === c.length && Math.floor(l / 20) % 2 === 0) {
                ctx.font = E.font(P, 'code', { size: 13 });
                E.box(ctx, -212 + ctx.measureText(c.slice(0, n)).width, y - 11, 7, 14, 1, P.ink2);
            }
        });
        ctx.restore();
        K.wipeText(ctx, P, 'cap', t(P, 'outro.tag'), CX, E.lerp(150, 232, lock > 0 ? E.expoOut(E.prog(l, 240, 24)) : 0), 560, l, 124, { align: 'center', middle: true, len: 30 });
        if (lock > 0) {
            var w = 280;
            E.ROUTE.forEach(function (s, i) {
                var k = E.expoOut(E.prog(l, 244 + i * 3, 18));
                E.box(ctx, CX - w / 2 + i * 40, 176, 38 * k, 6, 3, P.st[s]);
            });
            ctx.save();
            ctx.translate(CX, 150);
            var br = 1 + 0.01 * Math.sin(l * 0.08);
            ctx.scale(br, br);
            K.word(ctx, P, 'fankeel', 0, 0, 72, l, 240, { align: 'center', gap: 3 });
            ctx.restore();
            K.ring(ctx, CX, 124, 320, P.ink, l, 252, 44, 4);
            K.burst(ctx, P, CX, 124, l, 252, 32, 71);
        }
    }

    var SHOTS = [
        { name: 'hook', len: 240, beats: [0, 30, 60, 90, 120, 150, 180, 210], draw: hook },
        { name: 'logo', len: 240, beats: [0, 90, 150], draw: logo },
        { name: 'route', len: 240, beats: [0, 30, 60, 90, 120, 150, 180, 210], draw: route },
    ].concat(ST.SHOTS, [
        { name: 'clash', len: 360, beats: [0, 120, 150, 180, 210, 240], draw: clash },
        { name: 'numbers', len: 360, beats: [0, 60, 120, 180], draw: numbers },
        { name: 'outro', len: 480, beats: [0, 60, 120, 240], draw: outro },
    ]);
    var LENGTH = 3600;
    var STARTS = [];
    var end = SHOTS.reduce(function (at, c) { STARTS.push(at); return at + c.len; }, 0);
    if (end !== LENGTH) throw new Error('tour: the reel runs to ' + end + ' frames, not ' + LENGTH);

    function draw(ctx, f, P) {
        var i = SHOTS.length - 1;
        while (i > 0 && STARTS[i] > f) i--;
        SHOTS[i].draw(ctx, P, f - STARTS[i]);
    }

    var TOUR_REEL = {
        length: LENGTH,
        beats: SHOTS.map(function (c, i) {
            var b = { at: STARTS[i], label: c.name };
            if (E.ROUTE.indexOf(c.name) >= 0) b.stage = c.name;
            return b;
        }),
        stills: STARTS.reduce(function (out, s, i) { return out.concat([s + 45, s + 125, s + SHOTS[i].len - 25]); }, []),
        cues: {
            cuts: STARTS.slice(),
            blocks: SHOTS.reduce(function (out, c, i) { return out.concat(c.beats.map(function (b) { return STARTS[i] + b; })); }, []),
        },
        strings: K.S,
        draw: draw,
    };
    E.register('reel', TOUR_REEL);

    module.exports = { TOUR_REEL: TOUR_REEL, S: K.S };
    if (typeof window !== 'undefined') root.tourReel = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
