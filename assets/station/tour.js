// assets/station/tour.js — the tour's engine: easing, the beat lookup, the
// timeline registry and the renderer, plus the drawing helpers the three
// timeline files share. Every picture is a pure function of a frame number at
// 60 fps: nothing here reads a clock, schedules anything, or keeps state
// between frames. Loaded by tour.html as a plain script (window.tourEngine)
// and by the tests through require (module.exports) — one object either way.
(function (root, module) {
    'use strict';

    var W = 640, H = 360, FPS = 60, SUBFRAMES = 10;
    var ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

    // assets/station/station.css :root[data-theme=dark], value for value.
    // palette() reads the live tokens in a page; this is what Node and a
    // missing token fall back to. The frames are always dark.
    var DARK = {
        ground: '#0e1311', panel: '#161c1a', inset: '#1e2522',
        ink: '#e8ece6', ink2: '#a9b3ae', muted: '#8a9590', faint: '#65706b',
        rule: '#29312e', rule2: '#36403c', good: '#5cc27a', bad: '#ef8a6a',
        st: { survey: '#488acb', design: '#bf860c', plan: '#c35c9b', build: '#5e9f50', verify: '#8071c8', audit: '#d15d51', land: '#209993' },
        fUi: '"Bahnschrift","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC","DIN Alternate",system-ui,sans-serif',
        fMono: '"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",ui-monospace,monospace',
    };

    // One real finished session, as numbers only — never its task text:
    // .fankeel/sessions/0e6bf834-a451-48c2-a7a9-b642d4e5ffd9.json (per machine,
    // not in git), read 2026-09-27.
    //   clock[s]  = (clock[s][1] - clock[s][0]) / 1000
    //   waited[s] = waited[s] / 1000
    //   total     = (clock.land[1] - moves[0][1]) / 1000, first move to the end of land
    //   usd       = lib/prices.js costOf(usage.models).usd 33.465259
    //             + costOf(usage.subagents.models).usd 20.4050566
    //   agents    = usage.subagents.agents; land = the session's `land`
    var SESSION = {
        clock: { survey: 381.705, design: 349.82, plan: 82.189, build: 2577.297, verify: 768.294, audit: 644.888, land: 448.343 },
        waited: { survey: 198.846, design: 201.4, plan: 28.645, build: 78.271, verify: 3.711, audit: 5.583, land: 7.68 },
        total: 7624.014,
        usd: 53.8703156,
        agents: 42,
        land: { integration: 'merge', push: false },
    };

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function prog(f, start, dur) { return clamp01((f - start) / dur); }

    // The motion notes' three curves, as formulas. expo-out 1 − 2^(−10p);
    // back-out overshoot 1.70158 (about 10%); bounce-out the standard first
    // arc to 1 at p = 1/2.75 and then one rebound to .75 and back — only one.
    function expoOut(p) { p = clamp01(p); return p === 1 ? 1 : 1 - Math.pow(2, -10 * p); }
    function expoIn(p) { p = clamp01(p); return p === 0 ? 0 : Math.pow(2, 10 * p - 10); }
    var C1 = 1.70158, C3 = C1 + 1;
    function backOut(p) {
        p = clamp01(p);
        if (p === 0) return 0;
        var q = p - 1;
        return 1 + C3 * q * q * q + C1 * q * q;
    }
    var B_HIT = 1 / 2.75, B_MID = (B_HIT + 1) / 2, B_HALF = 1 - B_MID;
    function bounceOut(p) {
        p = clamp01(p);
        if (p < B_HIT) return 7.5625 * p * p;
        var q = (p - B_MID) / B_HALF;
        return 0.75 + 0.25 * q * q;
    }

    // Beats: no cache, no cursor. The answer for a frame depends on that frame
    // alone, which is what makes a seek land on the same picture every time.
    function beatAt(tl, f) {
        var i = -1;
        for (var k = 0; k < tl.beats.length; k++) if (tl.beats[k].at <= f) i = k;
        return i;
    }
    function stepBeat(tl, f, dir) {
        var k;
        if (dir > 0) {
            for (k = 0; k < tl.beats.length; k++) if (tl.beats[k].at > f) return tl.beats[k].at;
            return tl.length - 1;
        }
        for (k = tl.beats.length - 1; k >= 0; k--) if (tl.beats[k].at < f) return tl.beats[k].at;
        return 0;
    }
    function clock(f) {
        var s = f / FPS, m = Math.floor(s / 60), r = (s - m * 60).toFixed(2);
        return m + ':' + (Number(r) < 10 ? '0' : '') + r;
    }

    function check(tl) {
        var out = [];
        if (!tl || typeof tl.draw !== 'function') out.push('no draw function');
        var len = tl && tl.length;
        if (!(len > 0 && len % 1 === 0)) out.push('length is not a positive whole number of frames');
        var beats = (tl && tl.beats) || [];
        if (!beats.length) out.push('no beats');
        for (var i = 0; i < beats.length; i++) {
            var b = beats[i];
            if (!(b.at >= 0 && b.at < len)) out.push('beat ' + i + ' (' + b.label + ') at ' + b.at + ' is outside 0..' + (len - 1));
            if (i && !(b.at > beats[i - 1].at)) out.push('beat ' + i + ' (' + b.label + ') does not start after beat ' + (i - 1));
            if (!b.label) out.push('beat ' + i + ' has no label');
        }
        ((tl && tl.stills) || []).forEach(function (s) {
            if (!(s >= 0 && s < len)) out.push('still ' + s + ' is outside the timeline');
        });
        return out;
    }

    var REG = {};
    function register(name, tl) {
        var bad = check(tl);
        if (bad.length) throw new Error('tour: timeline ' + name + ': ' + bad.join('; '));
        REG[name] = tl;
        return tl;
    }
    function get(name) {
        if (!Object.prototype.hasOwnProperty.call(REG, name)) throw new Error('tour: no timeline named ' + name);
        return REG[name];
    }
    function names() { return Object.keys(REG); }
    function length(name) { return get(name).length; }

    function palette(read) {
        var P = { st: {} };
        ['ground', 'panel', 'inset', 'ink', 'ink2', 'muted', 'faint', 'rule', 'rule2', 'good', 'bad'].forEach(function (k) {
            P[k] = read(k) || DARK[k];
        });
        ROUTE.forEach(function (s) { P.st[s] = read('st-' + s) || DARK.st[s]; });
        P.fUi = read('f-ui') || DARK.fUi;
        P.fMono = read('f-mono') || DARK.fMono;
        return P;
    }

    function paint(ctx, tl, f, P) {
        ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.ground;
        ctx.fillRect(0, 0, W, H);
        tl.draw(ctx, f, P);
    }
    // Live playback draws once. Recording draws ten sub-frames, f + i/10, on a
    // scratch canvas and lays each over the last at 1/(i+1): a running mean,
    // so the result is the average of the ten.
    function render(ctx, name, frame, opts) {
        var o = opts || {}, tl = get(name), P = o.palette || DARK;
        if (!o.blur) { paint(ctx, tl, frame, P); return 1; }
        var make = o.makeCanvas || function () { return document.createElement('canvas'); };
        var sub = make();
        sub.width = ctx.canvas.width;
        sub.height = ctx.canvas.height;
        var sctx = sub.getContext('2d');
        for (var i = 0; i < SUBFRAMES; i++) {
            paint(sctx, tl, frame + i / SUBFRAMES, P);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1 / (i + 1);
            ctx.drawImage(sub, 0, 0);
        }
        ctx.globalAlpha = 1;
        return SUBFRAMES;
    }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function fmtClock(sec) {
        var s = Math.round(sec), m = Math.floor(s / 60);
        return m ? m + 'm' + pad2(s % 60) + 's' : s + 's';
    }
    function fmtSpan(sec) {
        var s = Math.round(sec);
        if (s >= 3600) { var m = Math.round(s / 60); return Math.floor(m / 60) + 'h ' + pad2(m % 60) + 'm'; }
        return Math.floor(s / 60) + 'm ' + pad2(s % 60) + 's';
    }
    function fmtMin(sec) { return Math.round(sec / 60) + 'm'; }
    function fmtUsd(usd) { return '$' + usd.toFixed(2); }

    // The storyboard's svg text classes (.v-h … .v-big): weight, size, family, colour.
    var FONTS = {
        h: ['600', 28, 'fUi', 'ink'], hc: ['600', 24, 'fUi', 'ink'], t: ['600', 15, 'fUi', 'ink'],
        b: ['400', 13, 'fUi', 'ink'], sub: ['400', 14, 'fUi', 'ink2'], s: ['400', 12, 'fUi', 'muted'],
        m: ['400', 12.5, 'fMono', 'ink2'], mi: ['600', 13, 'fMono', 'ink'], j: ['400', 11, 'fMono', 'ink2'],
        jn: ['400', 11, 'fMono', 'ink'], big: ['600', 22, 'fMono', 'ink'],
    };
    function text(ctx, P, cls, s, x, y, o) {
        var f = FONTS[cls];
        o = o || {};
        ctx.font = (o.weight || f[0]) + ' ' + (o.size || f[1]) + 'px ' + P[f[2]];
        ctx.fillStyle = o.fill || P[f[3]];
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(s, x, y);
    }
    function rr(ctx, x, y, w, h, r) {
        r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function box(ctx, x, y, w, h, r, fill, stroke, lw) {
        rr(ctx, x, y, w, h, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    function line(ctx, pts, color, lw, dash) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw || 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    function circle(ctx, x, y, r, fill, stroke, lw) {
        if (!(r > 0)) return;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    // The storyboard's check, `M x y l5 5 10-10`, scaled by s and drawn to a
    // fraction p of its length — p is what bounce-out drives.
    function tick(ctx, x, y, s, p, color, lw) {
        if (!(p > 0)) return;
        var a = [x, y], b = [x + 5 * s, y + 5 * s], c = [x + 15 * s, y - 5 * s];
        var l1 = Math.SQRT2 * 5 * s, l2 = Math.SQRT2 * 10 * s, d = Math.min(p, 1) * (l1 + l2);
        var pts = [a];
        if (d <= l1) pts.push([lerp(a[0], b[0], d / l1), lerp(a[1], b[1], d / l1)]);
        else pts.push(b, [lerp(b[0], c[0], (d - l1) / l2), lerp(b[1], c[1], (d - l1) / l2)]);
        line(ctx, pts, color, lw || 2.4);
    }
    // The route dots as the storyboard draws them: before `at` filled, `at`
    // filled and ringed (both scaled by `pop`, the back-out of its lighting),
    // after it hollow.
    function dots(ctx, P, x0, step, y, r, at, pop) {
        var k = pop === undefined ? 1 : pop;
        ROUTE.forEach(function (s, i) {
            var cx = x0 + i * step, c = P.st[s];
            if (i < at) circle(ctx, cx, y, r, c);
            else if (i === at) {
                circle(ctx, cx, y, (r + 1.5) * k, c);
                circle(ctx, cx, y, (r + 5) * k, null, c, 1.5);
            } else circle(ctx, cx, y, r, P.ground, P.rule2, 1.5);
        });
    }
    // The stages video's rail: M110 330H530, dots 70 apart.
    function rail(ctx, P, at, pop) {
        line(ctx, [[110, 330], [530, 330]], P.rule2, 5);
        dots(ctx, P, 110, 70, 330, 6, at, pop);
    }
    // Each stage's real duration as a share of the span, one unit between bars.
    function barRects(x, w) {
        var sum = 0;
        ROUTE.forEach(function (s) { sum += SESSION.clock[s]; });
        var room = w - (ROUTE.length - 1), cx = x;
        return ROUTE.map(function (s) {
            var bw = room * SESSION.clock[s] / sum, r = [cx, bw];
            cx += bw + 1;
            return r;
        });
    }
    // Bars grown left to right to `grow` of the span; a bar under 20 units
    // carries no label (plan's 1m does not fit), and a label shows once the
    // growth passes its bar's middle.
    function bars(ctx, P, x, y, w, h, labelY, grow) {
        var edge = x + w * clamp01(grow);
        barRects(x, w).forEach(function (r, i) {
            var s = ROUTE[i], vis = Math.min(r[1], edge - r[0]);
            if (vis > 0) box(ctx, r[0], y, vis, h, r[1] < 10 ? 1 : 2, P.st[s]);
            if (r[1] >= 20 && edge >= r[0] + r[1] / 2) text(ctx, P, 's', fmtMin(SESSION.clock[s]), r[0] + r[1] / 2, labelY, { align: 'center' });
        });
    }
    function fade(ctx, a, fn) {
        if (!(a > 0)) return;
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * Math.min(1, a);
        fn();
        ctx.restore();
    }

    module.exports = {
        W: W, H: H, FPS: FPS, SUBFRAMES: SUBFRAMES, ROUTE: ROUTE, DARK: DARK, SESSION: SESSION,
        clamp01: clamp01, lerp: lerp, prog: prog,
        expoOut: expoOut, expoIn: expoIn, backOut: backOut, bounceOut: bounceOut,
        beatAt: beatAt, stepBeat: stepBeat, clock: clock, check: check,
        register: register, get: get, names: names, length: length,
        palette: palette, render: render,
        fmtClock: fmtClock, fmtSpan: fmtSpan, fmtMin: fmtMin, fmtUsd: fmtUsd,
        text: text, rr: rr, box: box, line: line, circle: circle, tick: tick,
        dots: dots, rail: rail, barRects: barRects, bars: bars, fade: fade,
    };
    if (typeof window !== 'undefined') root.tourEngine = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
