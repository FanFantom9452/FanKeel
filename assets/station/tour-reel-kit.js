// assets/station/tour-reel-kit.js — what the kinetic promo's shots share:
// its string table, one `{ zh, en }` pair per string the frames print, and
// the motion pieces — the drifting dot field under every frame, a word whose
// letters rise out of a mask one after another, a shake that dies away, the
// flood that carries one stage's colour into the next, and the stage shot's
// frame of name, line and rail. Every piece is a pure function of a local
// frame `l`; nothing keeps state between frames.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');

    var S = {
        'hook.cap': { zh: '功能疊功能，文件疊文件。', en: 'Features pile up. So do the docs.' },
        'hook.stale': { zh: '已過時', en: 'Stale' },
        'logo.tag': { zh: 'fankeel 替每個任務排一條工作流。', en: 'fankeel gives every task its own workflow.' },
        'route.h': { zh: '七站，一條路。', en: 'Seven stages. One route.' },
        'what.survey': { zh: '先看已經有什麼', en: 'Look before you touch' },
        'what.design': { zh: '做法先講好', en: 'Agree the approach' },
        'what.plan': { zh: '拆成能照做的任務', en: 'Break it into tasks' },
        'what.build': { zh: '能平行就平行', en: 'Run what can run together' },
        'what.verify': { zh: '拿證據說話', en: 'Prove it' },
        'what.audit': { zh: '抓出過時的文件', en: 'Catch what went stale' },
        'what.land': { zh: '收乾淨再離開', en: 'Leave it clean' },
        'pr.survey': { zh: '產出：已經有什麼', en: 'Produces: a statement of what already exists' },
        'pr.design': { zh: '產出：一個有人同意的做法', en: 'Produces: an approach someone agreed to' },
        'pr.plan': { zh: '產出：沒上下文也能照做的拆解', en: 'Produces: steps a newcomer could execute' },
        'pr.build': { zh: '產出：改動本身', en: 'Produces: the change itself' },
        'pr.verify': { zh: '產出：證據，不是信心', en: 'Produces: evidence, not confidence' },
        'pr.audit': { zh: '產出：哪些已經不成立', en: 'Produces: a list of what is no longer true' },
        'pr.land': { zh: '產出：倉庫不比接手時亂', en: 'Produces: a repository no dirtier than you found it' },
        'design.ok': { zh: '已核准', en: 'Approved' },
        'plan.a': { zh: '倉庫維度', en: 'Warehouse key' },
        'plan.b': { zh: '調撥 API', en: 'Transfer API' },
        'plan.c': { zh: '調撥畫面', en: 'Transfer screen' },
        'par': { zh: '同時', en: 'In parallel' },
        'waits': { zh: '等 A', en: 'waits on A' },
        'build.queued': { zh: '排隊中', en: 'queued' },
        'verify.r1': { zh: '調撥後兩倉加總不變', en: 'Transfers keep the total' },
        'verify.r2': { zh: '單倉的舊呼叫照常', en: 'Old calls still work' },
        'verify.r3': { zh: '文件寫的是多倉', en: 'Docs describe multi-warehouse' },
        'audit.stale': { zh: '過時', en: 'Stale' },
        'audit.archived': { zh: '已歸檔', en: 'archived' },
        'land.clean': { zh: '工作樹乾淨', en: 'Working tree clean' },
        'clash.cap': { zh: '兩個 session 動到同一個檔，當下就標出來。', en: 'Two sessions touch one file, and it is flagged on the spot.' },
        'clash.same': { zh: '同一個檔', en: 'same file' },
        'clash.editing': { zh: '正在改', en: 'Editing' },
        'num.h': { zh: '一個真實任務的數字', en: 'One real task, in numbers' },
        'num.stages': { zh: '站，從盤點到收尾', en: 'stages, survey to land' },
        'num.agents': { zh: '個 subagent 分工', en: 'subagents shared the work' },
        'num.usd': { zh: '整個任務的花費', en: 'for the whole task' },
        'num.time': { zh: '從開始到落地', en: 'from start to landed' },
        'outro.two': { zh: '兩行指令，裝進 Claude Code。', en: 'Two commands, and it is in Claude Code.' },
        'outro.tag': { zh: '跟 AI 開發得再久，也不堆過時的引用和死程式。', en: 'Build with AI as long as you like — without piling up stale references and dead code.' },
    };
    function t(P, key) {
        if (!Object.prototype.hasOwnProperty.call(S, key)) throw new Error('tour: no reel string ' + key);
        return S[key][P.lang === 'en' ? 'en' : 'zh'];
    }

    // A fixed hash of an integer to 0..1, for anything that should look
    // scattered and still be the same every render.
    function rnd(i) {
        var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }
    function inOut(p) { p = E.clamp01(p); return p < 0.5 ? E.expoIn(p * 2) / 2 : 0.5 + E.expoOut(p * 2 - 1) / 2; }
    // 1 at `at`, dying over `len` frames, 0 before.
    function decay(l, at, len) { return l < at ? 0 : Math.exp(-(l - at) / len); }
    function hex(c, a) {
        var n = parseInt(String(c).slice(1), 16);
        return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    // The field under every frame: a dot every 40 units, drifting up and
    // left at a quarter unit a frame, so nothing ever quite holds still.
    function field(ctx, P, f) {
        var o = (f * 0.25) % 40;
        ctx.fillStyle = P.rule;
        for (var x = -o; x < E.W + 40; x += 40) {
            for (var y = -o; y < E.H + 40; y += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    // A shake: `amp` units at `at`, dying over 7 frames. Returns [dx, dy].
    function shake(l, at, amp) {
        var k = amp * decay(l, at, 7), d = l - at;
        return k ? [k * Math.sin(d * 2.9), k * Math.cos(d * 3.7)] : [0, 0];
    }

    // A word in the UI face, weight 700, its letters rising out of a mask
    // one after another from `at`, `gap` frames apart, each back-out over 16
    // frames. Only for ASCII words; the table's strings go through fitText.
    function word(ctx, P, s, x, y, size, l, at, o) {
        o = o || {};
        ctx.font = '700 ' + size + 'px ' + P.fUi;
        var total = ctx.measureText(s).width, cx = o.align === 'center' ? x - total / 2 : x, gap = o.gap || 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - size, y - size * 1.05, total + size * 2, size * 1.3);
        ctx.clip();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = o.fill || P.ink;
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i), w = ctx.measureText(ch).width, k = E.backOut(E.prog(l, at + i * gap, 16));
            if (k > 0) {
                ctx.save();
                ctx.translate(cx + w / 2, y + (1 - k) * size);
                ctx.rotate((1 - k) * 0.35);
                ctx.fillText(ch, -w / 2, 0);
                ctx.restore();
            }
            cx += w;
        }
        ctx.restore();
        return total;
    }
    // fitText revealed left to right by a mask whose edge runs expo-out
    // over `len` frames from `at`.
    function wipeText(ctx, P, cls, s, x, y, maxW, l, at, o) {
        o = o || {};
        var k = E.expoOut(E.prog(l, at, o.len || 20));
        if (!(k > 0)) return;
        var left = o.align === 'center' ? x - maxW / 2 : x;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left - 4, 0, (maxW + 8) * k, E.H);
        ctx.clip();
        ctx.translate((1 - k) * -24, 0);
        E.fitText(ctx, P, cls, s, x, y, maxW, o);
        ctx.restore();
    }
    // fitText popped in: scaled from `from` about its own centre, back-out
    // over 14 frames from `at`.
    function popText(ctx, P, cls, s, x, y, maxW, l, at, o) {
        o = o || {};
        var k = E.prog(l, at, 14);
        if (!(k > 0)) return;
        var sc = E.lerp(o.from || 2.2, 1, E.backOut(k));
        E.fade(ctx, k * 3, function () {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(sc, sc);
            E.fitText(ctx, P, cls, s, 0, 0, maxW, Object.assign({ align: 'center', middle: true }, o));
            ctx.restore();
        });
    }
    // A ring from (x, y) growing to `r` and fading, from `at` over `len`.
    function ring(ctx, x, y, r, color, l, at, len, lw) {
        var k = E.prog(l, at, len || 30);
        if (!(k > 0) || k >= 1) return;
        E.fade(ctx, 1 - k, function () { E.circle(ctx, x, y, r * E.expoOut(k), null, color, (lw || 3) * (1 - k) + 0.5); });
    }
    // Sparks thrown out from (x, y) at `at`: n of them, seeded, each its own
    // speed and one of the stage colours, slowing and fading over 40 frames.
    function burst(ctx, P, x, y, l, at, n, seed) {
        var k = E.prog(l, at, 40);
        if (!(k > 0) || k >= 1) return;
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.4, d = (60 + 140 * rnd(seed + i + 50)) * E.expoOut(k);
            E.fade(ctx, 1 - k, function () {
                E.circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 2.6 * (1 - k) + 0.6, P.st[E.ROUTE[i % 7]]);
            });
        }
    }
    // The flood: `color` from (x, y) covering the frame over the last 18
    // frames of a shot `len` long. It hands the colour to the next shot.
    function flood(ctx, l, len, x, y, color) {
        var k = E.expoIn(E.prog(l, len - 18, 18));
        if (k > 0) E.circle(ctx, x, y, 760 * k, color);
    }

    // The stage shot's frame. From the flood's colour a ground-coloured
    // circle opens from the picture's centre (4–30), leaving the colour as a
    // ring going out; then the index, the name letter by letter, the one-
    // line what, the product, and the rail of seven along the bottom. The
    // picture (`pic`, drawn about 470, 172) comes in over it; the last 18
    // frames flood with the next stage's colour from its rail dot.
    var PX = 470, PY = 172, RAIL = { x: 50, y: 326, step: 26 };
    function stageFrame(ctx, P, i, l, pic) {
        var s = E.ROUTE[i], c = P.st[s], next = E.ROUTE[i + 1];
        var open = E.expoOut(E.prog(l, 4, 26)), out = E.expoIn(E.prog(l, 214, 20));
        ctx.save();
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, E.W, E.H);
        ctx.beginPath();
        ctx.arc(PX, PY, 760 * open, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = P.ground;
        ctx.fillRect(0, 0, E.W, E.H);
        field(ctx, P, l);
        ctx.translate(-out * 90, 0);
        E.fade(ctx, 1 - out, function () {
            var n = '0' + (i + 1) + ' / 07';
            wipeText(ctx, P, 'm', n, 44, 74, 120, l, 10, { fill: c, len: 16 });
            var w = word(ctx, P, s, 44, 142, 58, l, 14, { gap: 3 });
            E.box(ctx, 44, 156, w * E.expoOut(E.prog(l, 30, 24)), 5, 2.5, c);
            wipeText(ctx, P, 'h', t(P, 'what.' + s), 44, 196, 300, l, 36, { size: 26, weight: '700', lines: 1 });
            wipeText(ctx, P, 'sub', t(P, 'pr.' + s), 44, 232, 300, l, 60, { size: 15, len: 26 });
            E.line(ctx, [[RAIL.x, RAIL.y], [RAIL.x + 6 * RAIL.step, RAIL.y]], P.rule2, 2);
            E.ROUTE.forEach(function (r, j) {
                var x = RAIL.x + j * RAIL.step, on = j === i;
                if (j < i) E.circle(ctx, x, RAIL.y, 4, P.st[r]);
                else if (on) {
                    var k = E.backOut(E.prog(l, 20, 14));
                    E.circle(ctx, x, RAIL.y, 6 * k, c);
                    E.circle(ctx, x, RAIL.y, (10 + 2 * Math.sin(l * 0.2)) * k, null, c, 1.5);
                } else E.circle(ctx, x, RAIL.y, 4, P.ground, P.rule2, 1.5);
            });
            ctx.save();
            ctx.translate(PX, PY);
            pic(ctx, P, l, c);
            ctx.restore();
        });
        ctx.restore();
        if (open < 1) ring(ctx, PX, PY, 760, c, l, 4, 26, 30);
        if (next) flood(ctx, l, 240, RAIL.x + (i + 1) * RAIL.step, RAIL.y, P.st[next]);
    }

    module.exports = {
        S: S, t: t, rnd: rnd, inOut: inOut, decay: decay, hex: hex,
        field: field, shake: shake, word: word, wipeText: wipeText, popText: popText,
        ring: ring, burst: burst, flood: flood, stageFrame: stageFrame, PX: PX, PY: PY,
    };
    if (typeof window !== 'undefined') root.tourReelKit = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
