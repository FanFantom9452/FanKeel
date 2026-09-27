// assets/station/tour-quickstart.js — video 1, Quick start (0:58, 3480 frames).
// VS Code's integrated terminal, running Claude Code, with TokenBar's real
// three-line statusline (badge + lead + the two usage bars). Opens on the
// four pains from README.md:11-15, then types /fankeel, watches survey find
// an existing file instead of a rewrite, answers Claude Code's own gate with
// "design", fast-forwards build and verify, meets a second live session
// clashing on the same file, lands, and closes on the keel line. The
// storyboard is `.fankeel/build/2026-09-27-tour-quickstart-terminal/mockup.html`
// (8 stills, `qs-pain` … `qs-close`); coordinates are its 640x360 viewBox.
// Numbers come from tourEngine.SESSION. The task title and file path are
// made up, as the storyboard says: no session's task text is drawn.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var S = E.SESSION;

    var TITLE = '報表加上 CSV 匯出';
    var WHERE = 'app/report.js';
    var CLAUDE = 'claude';
    var CMD2 = '/fankeel ' + TITLE;
    var PROMPT = 'PS C:\\code\\my-project> ';

    // The four pain cards, paraphrased from README.md:11-15 (the storyboard's
    // own wording) — never a real session's task text.
    var PAINS = [
        '元件重做了一次，因為沒人知道已經有一個。',
        '事情早就做完了，設計文件還在一份一份疊。',
        '約定守了一個月，然後悄悄沒人守了。',
        '兩個終端機改同一個檔案，誰都不知道對方在。'
    ];

    // This video's own route — the five stages this task actually visits
    // (it never runs plan or audit). tour.js's dots() always draws its own
    // seven-stage ROUTE, so the lead line's five dots are drawn as text here,
    // exactly as the real terminal (and the storyboard) draws them.
    var ROUTE5 = ['survey', 'design', 'build', 'verify', 'land'];
    var STAGE5 = { survey: 'SURVEY', design: 'DESIGN', build: 'BUILD', verify: 'VERIFY', land: 'LAND' };

    var LANDED = (S.land.integration === 'merge' ? '在本機合併' : S.land.integration) + '，沒有 push';

    // Every event, as a frame — the storyboard's own absolute frame numbers
    // (f 450, 800, 1380, 1680, 2580, 2940, 3240, 3460 are its eight stills;
    // this table is built around them, not rescaled).
    var EV = {
        painIn: 30, cardAt: [90, 180, 270, 360], cardDur: 24,
        panelGrow: 480, panelDur: 36,
        typeFrom: 520, perChar: 6, enter: 580, welcomeDur: 20, inputAt: 640,
        slashAt: 680, pickAt: 730, taskFrom: 740,
        userLine: 840, leadGrow: 850, leadDur: 24, orientAt: 870, orientBlink: 20, orientDone: 920,
        surveyAt: 1000, surveyDone: 1080, circleAt: 1140, circleDur: 18, replyFrom: 1200,
        cardUp: 1440, cardUpDur: 24, hlAt: 1500, enterFlash: 1740, flashDur: 12,
        collapseAt: 1770, crossAt: 1800, crossDur: 16, dotAt: 1800, dotDur: 20,
        ffLabel: 2040, buildAt: 2100, buildDur: 360, verifyAt: 2460,
        splitAt: 2640, splitDur: 30, rightBuild: 2700, redAt: 2760, redDur: 12,
        askAt: 2820, askDur: 24, midAt: 2880,
        noAt: 2990, collapseR: 3040, reapply: 3080, mergeAt: 3150,
        landDotAt: 3180, landDotDur: 20, summaryFrom: 3210,
        closeAt: 3300, closeDur: 30, taglineAt: 3330, moreAt: 3370, installAt: 3410
    };

    // -- small local helpers -------------------------------------------------

    function dotsStr(step) {
        var s = '';
        for (var i = 0; i < ROUTE5.length; i++) s += i < step ? '●' : '○';
        return s;
    }
    var PARTIAL = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
    function barStr(pct, width) {
        width = width || 10;
        if (pct == null) return '░'.repeat(width);
        var eighths = Math.round(E.clamp01(pct / 100) * width * 8);
        var full = Math.min(width, Math.floor(eighths / 8)), rem = eighths - full * 8;
        var s = '';
        for (var i = 0; i < full; i++) s += '█';
        if (full < width) { s += PARTIAL[rem]; s += '░'.repeat(Math.max(0, width - full - 1)); }
        return s;
    }
    function pctStr(pct) { return pct == null ? '--%' : Math.round(pct) + '%'; }

    // TokenBar's own three-line statusline (docs/90-agent/reference/statusline.md):
    // one badge word, a lead line with the route dots, the guard word, a
    // collision flag and the claimed path, then the model/project/branch line
    // and the two usage bars. Drawn as plain monospace text, the way the
    // terminal (and the storyboard's own <text> lead lines) draw it — never
    // as separate shapes, so the route dots read back as `●`/`○` characters.
    function lead(ctx, P, x, y, st, title) {
        if (!st.stage) return;
        var color = st.others ? P.bad : P.st[st.stage.toLowerCase()];
        var l1 = '▌FANKEEL ' + st.stage + '   ' + dotsStr(st.step) + '  ⚿ ask'
            + (st.others ? '  ⚑' + st.others : '')
            + (st.where ? '  ' + st.where : '') + '  ' + (title || TITLE);
        var l2 = '▌ Opus 5 | my-project | main ↑2';
        var l3 = '▌ ctx ' + barStr(st.ctx) + '  ' + pctStr(st.ctx) + '  │  5h ' + barStr(st.h5) + '  ' + pctStr(st.h5);
        E.text(ctx, P, 'm', l1, x, y, { fill: color });
        E.text(ctx, P, 'm', l2, x, y + 14);
        E.text(ctx, P, 'm', l3, x, y + 28);
    }

    // The lead's stage, dot count, collision flag and the two usage bars, at
    // any frame from f 850 on — a pure function of f, so a seek always draws
    // the same picture. Land's ctx% is `S.agents` (42), not a number invented
    // for the storyboard: one source (SESSION), reused where the summary row
    // already prints "42 個 agent" and here as the context percentage.
    function statusAt(f) {
        if (f < EV.leadGrow) return { stage: null };
        if (f < EV.crossAt) return { stage: STAGE5.survey, step: 1, ctx: 9, h5: 41 };
        if (f < EV.buildAt) return { stage: STAGE5.design, step: 2, ctx: 12, h5: 43 };
        if (f < EV.verifyAt) {
            var k = E.prog(f, EV.buildAt, EV.verifyAt - EV.buildAt);
            return { stage: STAGE5.build, step: 3, where: WHERE, ctx: E.lerp(16, 34, k), h5: E.lerp(45, 58, k) };
        }
        if (f < EV.redAt) return { stage: STAGE5.verify, step: 4, where: WHERE, ctx: 34, h5: 58 };
        if (f < EV.collapseR) return { stage: STAGE5.verify, step: 4, where: WHERE, others: 1, ctx: 36, h5: 61 };
        if (f < EV.landDotAt) return { stage: STAGE5.verify, step: 4, where: WHERE, ctx: 36, h5: 61 };
        return { stage: STAGE5.land, step: 5, where: WHERE, ctx: Math.round(S.agents), h5: 66 };
    }

    // A VS Code-ish frame, drawn locally with tour.js's own primitives — not
    // a shared helper, per the design's "no new chrome in tour.js" constraint.
    function vsCode(ctx, P) {
        E.box(ctx, 20, 16, 620, 332, 6, P.panel);
        E.line(ctx, [[20, 32], [640, 32]], P.rule2, 1);
        E.text(ctx, P, 's', 'README.md — my-project — Visual Studio Code', 330, 27, { align: 'center' });
        E.box(ctx, 20, 32, 20, 316, 0, P.inset);
        E.box(ctx, 40, 32, 190, 316, 0, P.panel);
        E.line(ctx, [[230, 32], [230, 348]], P.rule2, 1);
        E.text(ctx, P, 's', 'EXPLORER', 48, 46);
        E.text(ctx, P, 'm', 'README.md', 48, 62, { fill: P.ink });
        E.line(ctx, [[230, 226], [640, 226]], P.rule2, 1);
        E.text(ctx, P, 's', 'TERMINAL', 470, 240, { fill: P.ink });
        E.text(ctx, P, 'j', PROMPT, 240, 262);
        E.box(ctx, 560, 232, 79, 96, 0, P.inset);
        E.text(ctx, P, 'j', 'pwsh', 570, 250);
        E.text(ctx, P, 'j', 'pwsh', 570, 266);
        E.box(ctx, 20, 336, 620, 12, 0, P.inset);
        E.text(ctx, P, 's', 'main ↑2', 30, 345, { size: 9 });
    }

    // -- beat 1: pain (f 0–479) ------------------------------------------
    // The mockup's own explorer tree (qs-pain): the sidebar names a handful
    // of real-looking paths, each pain card gets a dashed connector to the
    // entry it is about and a red highlight behind that entry, plus a small
    // evidence caption under the card's own line. Additions local to this
    // beat only — vsCode() itself, shared with launch, is untouched.
    var TREE = [
        [76, 'app/components/DatePicker.tsx'], [88, 'app/components/DateRangeInput.tsx'], [100, 'app/components/DateSelect.tsx'],
        [124, 'app/report.js'], [136, 'app/toCsv.js'],
        [154, 'docs/plans/report-v2.md'], [166, 'docs/plans/report-v3-final.md'],
        [184, 'CONTRIBUTING.md'], [196, 'package.json']
    ];
    var EVIDENCE = [
        'DatePicker · DateRangeInput · DateSelect',
        'docs/plans/report-v3-final.md',
        'CONTRIBUTING.md',
        'app/report.js · pwsh × 2'
    ];
    // Where each card's connector lands and the red band behind that entry —
    // three in the sidebar tree, the fourth on the terminal's own pwsh pair.
    var HIT = [
        { x: 41, y: 70, w: 188, h: 34, to: [230, 88] },
        { x: 41, y: 160, w: 188, h: 12, to: [230, 166] },
        { x: 41, y: 178, w: 188, h: 12, to: [230, 184] },
        { x: 560, y: 232, w: 79, h: 34, to: [560, 258] }
    ];
    function pain(ctx, P, f) {
        vsCode(ctx, P);
        E.text(ctx, P, 's', '—    □    ×', 632, 11, { align: 'right', size: 8 });
        E.text(ctx, P, 's', 'Markdown', 632, 345, { align: 'right', size: 9 });
        TREE.forEach(function (row) { E.text(ctx, P, 's', row[1], 48, row[0], { size: 9, fill: P.ink2 }); });
        var m = E.expoOut(E.prog(f, 0, EV.painIn));
        E.fade(ctx, m, function () {
            ctx.fillStyle = P.ground;
            ctx.globalAlpha *= 0.93;
            ctx.fillRect(230, 32, 410, 194);
        });
        var t = E.expoOut(E.prog(f, EV.painIn, EV.cardDur));
        E.fade(ctx, t, function () { E.text(ctx, P, 't', '長期專案，會爛在任何一個 session 都看不到的地方。', 250, 60, { size: 13 }); });
        PAINS.forEach(function (txt, i) {
            var a = E.expoOut(E.prog(f, EV.cardAt[i], EV.cardDur));
            E.fade(ctx, a, function () {
                var y = 84 + 36 * i - 8 * (1 - a);
                var hit = HIT[i];
                ctx.save();
                ctx.globalAlpha *= 0.35;
                ctx.fillStyle = P.bad;
                ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
                ctx.restore();
                E.line(ctx, [[246, y + 14], hit.to], P.faint, 1, [3, 4]);
                E.box(ctx, 246, y, 360, 32, 5, null, P.rule2, 1);
                E.text(ctx, P, 'b', txt, 256, y + 15, { size: 11.5 });
                E.text(ctx, P, 's', EVIDENCE[i], 256, y + 27, { size: 9, fill: P.muted });
            });
        });
    }

    // -- beat 2: launch (f 480–839) ---------------------------------------
    function launch(ctx, P, f) {
        var grow = E.expoOut(E.prog(f, EV.panelGrow, EV.panelDur));
        E.fade(ctx, 1, function () { vsCode(ctx, P); });
        E.fade(ctx, grow, function () { E.box(ctx, 20, 32, 620, 316, 0, P.panel); });
        E.text(ctx, P, 'j', PROMPT, 40, 50);
        var typed = CLAUDE.slice(0, Math.max(0, Math.min(CLAUDE.length, Math.floor((f - EV.typeFrom) / EV.perChar) + 1)));
        E.text(ctx, P, 'j', typed, 40 + 8 * PROMPT.length, 50, { fill: P.ink });
        var w = E.expoOut(E.prog(f, EV.enter, EV.welcomeDur));
        if (w > 0) {
            E.fade(ctx, w, function () {
                E.box(ctx, 39.5, 59.5, 300, 62, 3, null, P.st.build, 1);
                E.text(ctx, P, 'j', '✻ Welcome to Claude Code!', 48, 78, { fill: P.ink });
                E.text(ctx, P, 'j', '  cwd: C:\\code\\my-project', 48, 111, { fill: P.muted });
            });
        }
        if (f >= EV.inputAt) {
            E.box(ctx, 39.5, 133.5, 598, 22, 3, null, P.rule2, 1);
            var menu = E.expoOut(E.prog(f, EV.slashAt, 18)) * (1 - E.expoIn(E.prog(f, EV.pickAt, 12)));
            if (menu > 0) {
                E.fade(ctx, menu, function () {
                    E.box(ctx, 46, 100, 300, 30, 4, P.inset);
                    E.text(ctx, P, 'mi', '/fankeel', 56, 120, { fill: P.ink });
                });
            }
            var typedTask = f >= EV.taskFrom ? CMD2.slice(0, Math.max(0, Math.min(CMD2.length, Math.floor((f - EV.taskFrom) / 8) + 1))) : '';
            E.text(ctx, P, 'j', '> ' + typedTask, 47, 149, { fill: P.ink });
            E.text(ctx, P, 's', 'ctx --%   │   5h --%', 47, 174, { size: 10 });
        }
    }

    // -- beat 3: survey (f 840–1439) ---------------------------------------
    function survey(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        E.text(ctx, P, 'j', '> ' + CMD2, 40, 50, { fill: P.ink2 });
        var blink = f >= EV.orientDone || Math.floor((f - EV.orientAt) / EV.orientBlink) % 2 === 0;
        if (f >= EV.orientAt) {
            E.text(ctx, P, 'j', (blink ? '⏺' : '○') + ' Bash(node scripts/orient.js)', 40, 76, { fill: P.good });
        }
        if (f >= EV.orientDone) {
            E.text(ctx, P, 'j', '  ⎿  my-project · git · 214 files · map.md 3 天前寫的', 40, 89, { fill: P.muted });
            E.text(ctx, P, 'j', '     這棵樹裡沒有其他 live session', 40, 102, { fill: P.muted });
        }
        if (f >= EV.surveyAt) {
            E.text(ctx, P, 'j', '⏺ Bash(node scripts/survey.js csv export)', 40, 128, { fill: P.good });
        }
        if (f >= EV.surveyDone) {
            var c = E.expoOut(E.prog(f, EV.circleAt, EV.circleDur));
            E.text(ctx, P, 'j', '  ⎿  files whose name matches:', 40, 141, { fill: P.muted });
            E.text(ctx, P, 'j', '       app/toCsv.js  1.2 KB', 40, 154, { fill: P.ink });
            E.text(ctx, P, 'j', '     … +11 lines (ctrl+o to expand)', 40, 167, { fill: P.muted });
            if (c > 0) {
                E.fade(ctx, c, function () {
                    E.box(ctx, 104.5, 141.5, 100, 14, 3, null, P.ink2, 1.2);
                    E.box(ctx, 206, 140, 128, 18, 9, P.panel, P.rule2, 1);
                    E.text(ctx, P, 's', '已經有一個了，不用重做', 270, 152, { fill: P.ink, size: 10 });
                });
            }
        }
        if (f >= EV.replyFrom) {
            var line1 = 'app/toCsv.js 已經會把資料列轉成 CSV。這次只要把它接上報表頁，';
            var line2 = '  不用再寫一支。';
            var n = Math.min(line1.length + line2.length, Math.floor((f - EV.replyFrom) / 1));
            E.text(ctx, P, 'j', '⏺ ' + line1.slice(0, Math.min(n, line1.length)), 40, 193, { fill: P.ink });
            if (n > line1.length) E.text(ctx, P, 'j', line2.slice(0, n - line1.length), 40, 206, { fill: P.ink });
        }
        E.box(ctx, 39.5, 220.5, 598, 22, 3, null, P.rule2, 1);
        var l = E.expoOut(E.prog(f, EV.leadGrow, EV.leadDur));
        E.fade(ctx, l, function () { lead(ctx, P, 40, 262, statusAt(f)); });
    }

    // -- beat 4: gate (f 1440–2039) -----------------------------------------
    var GATE = ['design (Recommended)', 'plan', 'build'];
    function gate(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        E.text(ctx, P, 'j', '⏺ app/toCsv.js 可以直接用，報表頁只差一個匯出按鈕。', 40, 50, { fill: P.ink });
        var k = E.expoOut(E.prog(f, EV.cardUp, EV.cardUpDur));
        E.fade(ctx, k, function () {
            E.box(ctx, 39.5, 63.5, 460, 172, 5, P.inset);
            E.box(ctx, 52, 70, 62, 15, 3, P.ink2);
            E.text(ctx, P, 'j', '☐ 下一站', 58, 81, { fill: P.ground, size: 10 });
            E.text(ctx, P, 'b', 'survey 做完了。下一站走哪裡？', 52, 100);
            var collapsed = f >= EV.collapseAt;
            if (!collapsed) {
                GATE.forEach(function (o, i) {
                    var on = i === 0 && f >= EV.hlAt;
                    var flash = i === 0 && E.prog(f, EV.enterFlash, EV.flashDur) > 0 && f < EV.collapseAt;
                    E.text(ctx, P, on || flash ? 'mi' : 'm', (on ? '❯ ' : '  ') + (i + 1) + '. ' + o, 60, 124 + 22 * i, on ? { fill: P.st.design } : null);
                });
                E.text(ctx, P, 's', '4. Type something.', 64, 124 + 22 * GATE.length, { size: 10.5, fill: P.muted });
                E.text(ctx, P, 's', 'Enter to select · ↑/↓ to navigate · Esc to cancel', 52, 124 + 22 * (GATE.length + 1), { size: 9.5 });
            } else {
                E.text(ctx, P, 'm', '⎿ 下一站：design', 60, 124, { fill: P.st.design });
            }
        });
        E.box(ctx, 39.5, 305.5, 598, 22, 3, null, P.rule2, 1);
        lead(ctx, P, 40, 262, statusAt(f));
    }

    // -- beat 5: build + verify, fast-forwarded (f 2040–2639) ---------------
    // The mockup's full tool-call log (qs-build), one row every 24 frames from
    // EV.ffLabel — a bounded reveal, not an unbounded scroll: `revealed` never
    // exceeds LOG.length, and `scroll` never exceeds what the panel actually
    // needs (`maxScroll`), so every row is on-screen well before f 2580.
    var LOG = [
        ['⏺ Update(app/report.js)', '  ⎿  Updated app/report.js with 18 additions and 2 removals'],
        ['⏺ Update(app/report.html)', '  ⎿  Updated app/report.html with 6 additions'],
        ['⏺ Bash(node --test)', '  ⎿  ℹ tests 51  ℹ pass 51  ℹ fail 0'],
        ['⏺ fankeel-reviewer(review task 2)', '  ⎿  Done'],
        ['⏺ task 2 過了 review，進 verify。', '']
    ];
    var LOG_ROW = 26, LOG_TOP = 46, LOG_BOTTOM = 210;
    function buildVerify(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        var revealed = Math.max(0, Math.min(LOG.length, Math.floor((f - EV.ffLabel) / 24) + 1));
        var contentH = LOG.length * LOG_ROW;
        var maxScroll = Math.max(0, contentH - (LOG_BOTTOM - LOG_TOP));
        var scroll = Math.min(maxScroll, Math.max(0, revealed * LOG_ROW - (LOG_BOTTOM - LOG_TOP)));
        LOG.forEach(function (pair, i) {
            if (i >= revealed) return;
            var y = LOG_TOP + 4 + LOG_ROW * i - scroll;
            if (y < LOG_TOP - LOG_ROW || y > LOG_BOTTOM) return;
            E.text(ctx, P, 'j', pair[0], 40, y, { fill: P.ink });
            if (pair[1]) E.text(ctx, P, 'j', pair[1], 40, y + 13, { fill: P.muted, size: 10.5 });
        });
        var l = E.expoOut(E.prog(f, EV.ffLabel, 16));
        E.fade(ctx, l, function () {
            E.box(ctx, 500, 32, 120, 18, 9, P.inset);
            E.text(ctx, P, 's', '▸▸ 快轉', 560, 44, { align: 'center', size: 10 });
        });
        E.text(ctx, P, 'j', '✻ Verifying… (esc to interrupt)', 40, 236, { fill: P.st.verify });
        E.box(ctx, 39.5, 254.5, 598, 22, 3, null, P.rule2, 1);
        var st = statusAt(f);
        lead(ctx, P, 40, 290, st);
        E.text(ctx, P, 's', 'build ' + E.fmtMin(S.clock.build) + ' · verify ' + E.fmtMin(S.clock.verify), 560, 28, { align: 'right', size: 10 });
    }

    // -- beat 6: clash (f 2640–3119) ------------------------------------------
    // The mockup's split terminal: left is this session's own verify, caught
    // mid-edit by the guard's ask; right is the second session's own build,
    // with its own status line and its own title (report-v2's task, never
    // this task's own text) — two sessions, two lead lines.
    var OTHER_TITLE = '報表分頁改版';
    function clash(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        var split = E.expoOut(E.prog(f, EV.splitAt, EV.splitDur));
        var midX = E.lerp(640, 380, split);
        var others = statusAt(f).others;
        var rail = others ? P.bad : P.st.verify;

        // left pane: verify's own edit, colliding with the other session's claim.
        E.text(ctx, P, 'j', '⏺ Bash(node --test)', 40, 50, { fill: P.muted });
        E.text(ctx, P, 'j', '  ⎿  ℹ tests 51  ℹ pass 51  ℹ fail 0', 40, 63, { fill: P.muted, size: 10 });
        E.text(ctx, P, 'j', '⏺ verify 發現匯出的 CSV 少了表頭，補一行。', 40, 89, { fill: P.ink });
        E.text(ctx, P, 'j', '⏺ Update(app/report.js)', 40, 115, { fill: P.ink });
        E.text(ctx, P, 'j', 'Edit file', 40, 137, { fill: P.ink });
        E.box(ctx, 39.5, 143.5, 340, 30, 3, null, P.rule2, 1);
        E.text(ctx, P, 'j', '17   const rows = report.rows();', 46, 155, { fill: P.muted });
        ctx.save();
        ctx.globalAlpha *= 0.16;
        ctx.fillStyle = P.good;
        ctx.fillRect(40, 160, 336, 11);
        ctx.restore();
        E.text(ctx, P, 'j', '18 + rows.unshift(columns.map((c) => c.label));', 46, 168, { fill: P.good });
        E.box(ctx, 32, 44, 4, 280, 0, rail);
        if (f >= EV.askAt) {
            E.fade(ctx, E.expoOut(E.prog(f, EV.askAt, EV.askDur)), function () {
                E.text(ctx, P, 'j', 'fankeel: app/report.js is claimed by another live session.', 40, 189, { fill: P.bad });
                E.text(ctx, P, 'j', '  - ' + OTHER_TITLE + ' @ build', 40, 202, { fill: P.bad });
                E.text(ctx, P, 'j', 'Do you want to make this edit to report.js?', 40, 220, { fill: P.ink });
                E.text(ctx, P, 'j', '❯ 1. Yes', 40, 236, { fill: P.st.verify });
                E.text(ctx, P, 'j', '  2. Yes, allow all edits during this session (shift+tab)', 40, 249);
                E.text(ctx, P, 'j', '  3. No, and tell Claude what to do differently (esc)', 40, 262);
            });
        }
        lead(ctx, P, 40, 296, { stage: STAGE5.verify, step: 4, others: others, where: WHERE, ctx: statusAt(f).ctx, h5: statusAt(f).h5 });

        // right pane: the second session's own build — its own line, its own
        // status, its own input box and its own statusline.
        if (split > 0.02) {
            E.fade(ctx, split, function () {
                E.line(ctx, [[midX, 32], [midX, 348]], P.rule2, 1);
                E.text(ctx, P, 'j', '> /fankeel ' + OTHER_TITLE, midX + 10, 50, { fill: P.ink2 });
                if (f >= EV.rightBuild) {
                    E.text(ctx, P, 'j', '⏺ Update(app/report.js)', midX + 10, 76, { fill: P.ink });
                    E.text(ctx, P, 'j', '  ⎿  Updated app/report.js with', midX + 10, 89, { fill: P.muted, size: 10 });
                    E.text(ctx, P, 'j', '     40 additions and 12 removals', midX + 10, 102, { fill: P.muted, size: 10 });
                    E.text(ctx, P, 'j', '✻ Building… (esc to interrupt)', midX + 10, 128, { fill: P.st.build });
                    E.box(ctx, midX + 8.5, 138.5, 640 - midX - 18, 22, 3, null, P.rule2, 1);
                    E.text(ctx, P, 'j', '> ', midX + 16, 153, { fill: P.ink2 });
                    lead(ctx, P, midX + 10, 180, { stage: STAGE5.build, step: 3, others: others, where: WHERE, ctx: 22, h5: statusAt(f).h5 }, OTHER_TITLE);
                }
                E.box(ctx, midX + 4, 44, 4, 280, 0, rail);
            });
        }
        if (f >= EV.midAt) {
            E.fade(ctx, E.expoOut(E.prog(f, EV.midAt, 18)), function () {
                E.text(ctx, P, 's', '兩個 session，同一個 app/report.js', 500, 246, { align: 'center', size: 10 });
            });
        }
    }

    // -- beat 7: land, then close (f 3120–3479) -------------------------------
    function land(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        if (f < EV.mergeAt) {
            E.text(ctx, P, 'j', '⏺ 另一個 session 收工了，重新套用剛才的修改。', 40, 60, { fill: P.ink });
        } else {
            E.text(ctx, P, 'j', '⏺ Bash(git merge --no-ff fankeel/report-csv)', 40, 60, { fill: P.ink });
            E.text(ctx, P, 'j', '  ⎿  Merge made by the \'ort\' strategy.', 40, 73, { fill: P.muted });
            var t = E.expoOut(E.prog(f, EV.summaryFrom, 30));
            E.fade(ctx, t, function () {
                E.text(ctx, P, 'j', '⏺ land 完成：' + LANDED + '。', 40, 96, { fill: P.ink });
                E.text(ctx, P, 'j', '  起點到 land ' + E.fmtSpan(S.total) + ' · 花費 ' + E.fmtUsd(S.usd) + ' · '
                    + Math.round(S.agents) + ' 個 agent', 40, 109, { fill: P.muted });
            });
        }
        E.box(ctx, 39.5, 254.5, 598, 22, 3, null, P.rule2, 1);
        lead(ctx, P, 40, 290, statusAt(f));

        if (f >= EV.closeAt) {
            var dim = E.expoOut(E.prog(f, EV.closeAt, EV.closeDur));
            E.fade(ctx, dim * 0.84, function () { ctx.fillStyle = P.ground; ctx.fillRect(0, 0, E.W, E.H); });
            E.fade(ctx, dim, function () {
                E.box(ctx, 100, 84, 440, 192, 10, null, P.rule2, 1);
                E.text(ctx, P, 'h', 'fankeel', 320, 120, { align: 'center' });
                var tag = E.expoOut(E.prog(f, EV.taglineAt, 20));
                E.fade(ctx, tag, function () { E.text(ctx, P, 'hc', '龍骨，是船身唯一不能少的那根構件。', 320, 160, { align: 'center' }); });
                var more = E.expoOut(E.prog(f, EV.moreAt, 20));
                E.fade(ctx, more, function () {
                    E.text(ctx, P, 'sub', '任何一個 session 看不到的，fankeel 替它記著：', 320, 192, { align: 'center' });
                    E.text(ctx, P, 'sub', '已經有什麼、走到哪一站、誰也在改同一個檔案。', 320, 212, { align: 'center' });
                });
                var inst = E.expoOut(E.prog(f, EV.installAt, 20));
                E.fade(ctx, inst, function () { E.text(ctx, P, 'm', 'claude plugin marketplace add FanFantom9452/FanKeel', 320, 254, { align: 'center' }); });
            });
        }
    }

    function draw(ctx, f, P) {
        if (f < EV.panelGrow) { pain(ctx, P, f); return; }
        if (f < EV.userLine) { launch(ctx, P, f); return; }
        if (f < EV.cardUp) { survey(ctx, P, f); return; }
        if (f < EV.ffLabel) { gate(ctx, P, f); return; }
        if (f < EV.splitAt) { buildVerify(ctx, P, f); return; }
        if (f < EV.noAt + 130) { clash(ctx, P, f); return; }
        land(ctx, P, f);
    }

    var QUICKSTART = {
        length: 3480,
        beats: [
            { at: 0, label: 'pick' },
            { at: 840, label: 'survey', stage: 'survey' },
            { at: 1440, label: 'gate', stage: 'design' },
            { at: 3120, label: 'land', stage: 'land' }
        ],
        stills: [450, 800, 1380, 1680, 2580, 2940, 3240, 3460],
        draw: draw
    };
    E.register('quickstart', QUICKSTART);

    module.exports = { QUICKSTART: QUICKSTART };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
