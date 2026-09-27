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

    var WAITED = E.ROUTE.reduce(function (a, s) { return a + S.waited[s]; }, 0);
    var LANDED = (S.land.integration === 'merge' ? '在本機合併' : S.land.integration) + '，沒有 push';

    // Every event, as a frame — the storyboard's own absolute frame numbers
    // (f 450, 800, 1380, 1680, 2580, 2940, 3240, 3460 are its eight stills;
    // this table is built around them, not rescaled).
    var EV = {
        painIn: 30, cardAt: [90, 180, 270, 360], cardDur: 24, dashDur: 18, hitDur: 12,
        panelGrow: 480, panelDur: 36, fadeDur: 16,
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
    function lead(ctx, P, x, y, st) {
        if (!st.stage) return;
        var color = st.others ? P.bad : P.st[st.stage.toLowerCase()];
        var l1 = '▌FANKEEL ' + st.stage + '   ' + dotsStr(st.step) + '  ⚿ ask'
            + (st.others ? '  ⚑' + st.others : '')
            + (st.where ? '  ' + st.where : '') + '  ' + TITLE;
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
    function pain(ctx, P, f) {
        vsCode(ctx, P);
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
                E.box(ctx, 246, y, 360, 28, 5, null, P.rule2, 1);
                E.text(ctx, P, 'b', txt, 256, y + 18, { size: 11.5 });
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
            E.text(ctx, P, 'j', '  ⎿  my-project · git · 214 files', 40, 92, { fill: P.muted });
        }
        if (f >= EV.surveyAt) {
            E.text(ctx, P, 'j', '⏺ Bash(node scripts/survey.js csv export)', 40, 118, { fill: P.good });
        }
        if (f >= EV.surveyDone) {
            var c = E.expoOut(E.prog(f, EV.circleAt, EV.circleDur));
            E.text(ctx, P, 'j', '  ⎿  files whose name matches:', 40, 134, { fill: P.muted });
            E.text(ctx, P, 'j', '       app/toCsv.js  1.2 KB', 40, 148, { fill: P.ink });
            if (c > 0) {
                E.fade(ctx, c, function () {
                    E.box(ctx, 105, 138, 100, 14, 3, null, P.st.survey, 1.4);
                    E.text(ctx, P, 's', '已經有一個了，不用重做', 220, 148, { fill: P.st.survey, size: 10 });
                });
            }
        }
        if (f >= EV.replyFrom) {
            var n = Math.min(28, Math.floor((f - EV.replyFrom) / 1));
            var full = 'app/toCsv.js 已經會把資料列轉成 CSV，接上報表頁就好。';
            E.text(ctx, P, 'j', '⏺ ' + full.slice(0, n), 40, 174, { fill: P.ink });
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
            E.box(ctx, 39.5, 63.5, 460, 158, 5, P.inset);
            E.text(ctx, P, 'b', 'survey 做完了。下一站走哪裡？', 52, 88);
            var collapsed = f >= EV.collapseAt;
            if (!collapsed) {
                GATE.forEach(function (o, i) {
                    var on = i === 0 && f >= EV.hlAt;
                    var flash = i === 0 && E.prog(f, EV.enterFlash, EV.flashDur) > 0 && f < EV.collapseAt;
                    E.text(ctx, P, on || flash ? 'mi' : 'm', (on ? '❯ ' : '  ') + (i + 1) + '. ' + o, 60, 112 + 22 * i, on ? { fill: P.st.design } : null);
                });
            } else {
                E.text(ctx, P, 'm', '⎿ 下一站：design', 60, 112, { fill: P.st.design });
            }
        });
        E.box(ctx, 39.5, 305.5, 598, 22, 3, null, P.rule2, 1);
        lead(ctx, P, 40, 262, statusAt(f));
    }

    // -- beat 5: build + verify, fast-forwarded (f 2040–2639) ---------------
    var LOG = [
        ['⏺ Update(app/report.js)', '  ⎿  Updated app/report.js with 18 additions and 2 removals'],
        ['⏺ Update(app/report.html)', '  ⎿  Updated app/report.html with 6 additions'],
        ['⏺ Bash(node --test)', '  ⎿  ℹ tests 51  ℹ pass 51  ℹ fail 0'],
        ['⏺ fankeel-reviewer(review task 2)', '  ⎿  Done']
    ];
    function buildVerify(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        var row = Math.floor((f - EV.ffLabel) / 24);
        LOG.forEach(function (pair, i) {
            var y = 50 + 26 * i - 26 * Math.max(0, row - 3);
            if (y < 46 || y > 210) return;
            E.text(ctx, P, 'j', pair[0], 40, y, { fill: P.ink });
            E.text(ctx, P, 'j', pair[1], 40, y + 13, { fill: P.muted, size: 10.5 });
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
    function clash(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        var split = E.expoOut(E.prog(f, EV.splitAt, EV.splitDur));
        var midX = E.lerp(640, 380, split);
        E.line(ctx, [[midX, 32], [midX, 348]], P.rule2, 1);
        E.text(ctx, P, 'j', '⏺ verify 發現匯出的 CSV 少了表頭，補一行。', 40, 60, { fill: P.ink });
        var others = statusAt(f).others;
        var rail = others ? P.bad : P.st.verify;
        E.box(ctx, 32, 44, 4, 280, 0, rail);
        if (f >= EV.askAt) {
            E.fade(ctx, E.expoOut(E.prog(f, EV.askAt, EV.askDur)), function () {
                E.text(ctx, P, 'j', 'fankeel: app/report.js is claimed by another live session.', 40, 190, { fill: P.bad });
                E.text(ctx, P, 'j', '  - 報表分頁改版 @ build', 40, 203, { fill: P.bad });
                E.text(ctx, P, 'j', '❯ 1. Yes    2. Yes, allow all    3. No', 40, 226);
            });
        }
        if (split > 0.1 && midX < 620) {
            E.fade(ctx, split, function () {
                E.text(ctx, P, 'j', '> /fankeel 報表分頁改版', midX + 10, 50, { fill: P.ink2 });
                if (f >= EV.rightBuild) E.text(ctx, P, 'j', '⏺ Update(app/report.js)', midX + 10, 76, { fill: P.ink });
                E.box(ctx, midX + 4, 44, 4, 280, 0, rail);
            });
        }
        if (f >= EV.midAt) {
            E.fade(ctx, E.expoOut(E.prog(f, EV.midAt, 18)), function () {
                E.text(ctx, P, 's', '兩個 session，同一個 app/report.js', 500, 246, { align: 'center', size: 10 });
            });
        }
        E.box(ctx, 39.5, 305.5, 598, 22, 3, null, P.rule2, 1);
        lead(ctx, P, 40, 262, statusAt(f));
    }

    // -- beat 7: land, then close (f 3120–3479) -------------------------------
    function land(ctx, P, f) {
        E.fade(ctx, 1, function () { E.box(ctx, 20, 16, 620, 316, 6, P.panel); });
        if (f < EV.mergeAt) {
            E.text(ctx, P, 'j', '⏺ 另一個 session 收工了，重新套用剛才的修改。', 40, 60, { fill: P.ink });
        } else {
            E.text(ctx, P, 'j', '⏺ Bash(git merge --no-ff fankeel/report-csv)', 40, 60, { fill: P.ink });
            E.text(ctx, P, 'j', '  ⎿  Merge made by the \'ort\' strategy.', 40, 73, { fill: P.muted });
            var t = E.expoOut(E.prog(f, EV.summaryFrom, 40));
            E.fade(ctx, t, function () {
                E.text(ctx, P, 'j', '⏺ land 完成：' + LANDED + '。', 40, 96, { fill: P.ink });
                E.stats(ctx, P, [[150, E.fmtSpan(S.total), '起點到 land'], [300, E.fmtUsd(S.usd), '花費'],
                    [420, String(Math.round(S.agents)), 'agents'], [560, E.fmtSpan(WAITED), 'waited on you']], 150, 172);
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
