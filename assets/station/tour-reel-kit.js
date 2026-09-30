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
    // promo30v5's own strings (tour-ring.js), kept apart from S so the reel,
    // which draws every string of S, is not asked to draw them. Verbatim
    // from the v5 styleframes' tables: .fankeel/build/2026-09-30-promo30-v5/
    // mockup-v5-tour.html (its NEW) and, for the hook, hook-variants.html's
    // variant E. v5 reads v1's strings (what.*, pr.*, logo.tag …) from S.
    var V5 = {
        'cap.bigger': { zh: '專案一天比一天大', en: 'The project grows every day.' },
        'cap.grow': { zh: '每跑一次，就多幾個檔', en: 'Every run leaves a few more files.' },
        'cap.docs': { zh: '沒人引用的留著，新舊版本互相矛盾', en: 'Unused docs stay, and old and new versions disagree.' },
        'cap.orphan': { zh: '沒人引用，也沒人敢刪', en: 'Nothing uses it, nobody dares delete it.' },
        'cap.grep': { zh: '用 grep 找，漏掉關鍵的檔', en: 'grep finds some, and misses the ones that matter.' },
        'cap.readall': { zh: '全部讀，token 暴增', en: 'Read it all, and tokens explode.' },
        'e.files': { zh: '檔案', en: 'files' },
        'e.runs': { zh: '每跑一次', en: 'each run' },
        'e.orphan': { zh: '沒被引用', en: 'unreferenced' },
        'e.contra': { zh: '互相矛盾', en: 'contradicts' },
        'e.lgGrey': { zh: '沒有任何檔引用它', en: 'nothing links to it' },
        'e.lgRed': { zh: '兩份說法不同', en: 'two versions disagree' },
        'e.task': { zh: '修一個登入 bug', en: 'Fix a login bug' },
        'e.nfiles': { zh: '個檔', en: 'files' },
        'e.miss': { zh: '漏讀', en: 'missed' },
        'e.lgHit': { zh: 'grep 找到的', en: 'grep found it' },
        'e.lgMiss': { zh: '該讀，但裡面沒寫 login', en: 'needed, but never says login' },
        'e.read': { zh: '已讀', en: 'Read' },
        'b.task': { zh: '任務', en: 'Task' },
        'b.tok': { zh: 'token（示意）', en: 'tokens (illustrative)' },
        'b.split': { zh: '花在哪裡（示意）', en: 'Where they went (illustrative)' },
        'b.old': { zh: '讀舊文件', en: 'old docs' },
        'b.work': { zh: '做任務', en: 'the task' },
        'b.edit': { zh: '改動', en: 'Changes' },
        'b.none': { zh: '還沒開始', en: 'none yet' },
        'prob.survey': { zh: 'AI 沒看就重寫已經存在的東西', en: 'The AI rewrites what already exists without looking.' },
        'prob.design': { zh: '沒講好就動手，做錯方向', en: 'It starts before anyone agrees, and builds the wrong thing.' },
        'prob.plan': { zh: '文件太長，注意力被稀釋', en: 'The doc is too long, and attention thins out.' },
        'prob.build': { zh: '一個 AI 慢慢做；兩個 session 改到同一個檔', en: 'One AI works through it alone; two sessions edit the same file.' },
        'prob.verify': { zh: 'AI 說「應該可以了」', en: 'The AI says “it should work now.”' },
        'prob.audit': { zh: '程式改了，文件還寫舊的', en: 'The code changed. The docs still say the old thing.' },
        'prob.land': { zh: '做完留下一堆暫存和分支', en: 'It finishes and leaves temp files and branches behind.' },
        'd.dupe': { zh: '已經有了', en: 'already here' },
        'd.want': { zh: '要的', en: 'Wanted' },
        'd.got': { zh: '做出來的', en: 'Built' },
        'what.design.scope': { zh: '先畫範圍，再寫 spec 定方向', en: 'Draw the scope, then write the spec that sets the direction' },
        'd.req': { zh: '訂單出貨時通知客戶', en: 'Tell customers when their order ships' },
        'd.linesU': { zh: '行', en: 'lines' },
        'd.tooBig': { zh: '範圍太大', en: 'Way too big' },
        'd.goal': { zh: '目標', en: 'Goal' },
        'd.goalLine': { zh: '訂單出貨時，在訂單頁告訴客戶', en: 'When an order ships, tell the customer on the order page' },
        'd.in': { zh: '範圍內', en: 'In scope' },
        'd.in1': { zh: '狀態變成「已出貨」時觸發', en: 'Fires when the status turns Shipped' },
        'd.in2': { zh: '發一則站內通知', en: 'One in-app notice' },
        'd.in3': { zh: '顯示在訂單頁', en: 'Shown on the order page' },
        'd.out': { zh: '範圍外', en: 'Out of scope' },
        'd.out1': { zh: '不發 Email、簡訊、推播', en: 'No email, SMS or push' },
        'd.out2': { zh: '不加新服務、新頁面', en: 'No new service or page' },
        'd.out3': { zh: '不改資料表', en: 'No schema changes' },
        'd.accept': { zh: '驗收條件', en: 'Done when' },
        'd.acc1': { zh: '出貨後，客戶在訂單頁看到通知', en: 'The customer sees it on the order page' },
        'd.acc2': { zh: '不新增服務、不改資料表', en: 'No new service, no schema change' },
        'd.how': { zh: '做法', en: 'Approach' },
        'd.howLine': { zh: '沿用現有的通知元件', en: 'Reuse the existing notice component' },
        'd.attach': { zh: '附：畫面草圖', en: 'Attached: screen sketch' },
        'd.agree': { zh: '同意', en: 'Agree' },
        'what.plan.short': { zh: '每份都短，AI 的注意力是滿的', en: 'Each one is short, so attention stays full.' },
        'p.more': { zh: '＋ 讀進來的程式碼、紀錄、討論…', en: '+ the code, logs and talk read in beside it…' },
        'p.miss': { zh: '漏看', en: 'Missed' },
        'p.attn': { zh: '注意力', en: 'Attention' },
        'p.split': { zh: '自動拆解', en: 'Split it up' },
        'p.t1': { zh: '出貨狀態觸發事件', en: 'Fire an event on Shipped' },
        'p.t2': { zh: '站內通知元件接上', en: 'Wire up the notice' },
        'p.t3': { zh: '訂單頁顯示通知', en: 'Show it on the order page' },
        'p.t4': { zh: '測試', en: 'Tests' },
        'p.edits': { zh: '改', en: 'Edits' },
        'p.proof': { zh: '驗收', en: 'Proved by' },
        'p.waits': { zh: '等', en: 'Waits on' },
        'p.noWait': { zh: '不用等', en: 'Nothing' },
        'what.build.deal': { zh: '一份任務，交給一個 AI', en: 'Each task goes to its own agent.' },
        'b.changes': { zh: '改動', en: 'Changes' },
        'build.review': { zh: '每份改動都有人對抗審查', en: 'Every change gets an adversarial review.' },
        'build.pass': { zh: '挑出問題才放行', en: 'It passes only after the flaws are fixed.' },
        'b.reviewer': { zh: '審查', en: 'Reviewer' },
        'b.flaw': { zh: '已取消的訂單也會發通知', en: 'A cancelled order still gets the notice' },
        'b.back': { zh: '退回', en: 'Sent back' },
        'b.pass': { zh: '通過', en: 'Passed' },
        'b.reviewed': { zh: '審查', en: 'Reviewed' },
        'd.dispatch': { zh: '分派', en: 'Dispatch' },
        'd.should': { zh: '應該可以了', en: 'Should work now' },
        'd.notrun': { zh: '沒跑過', en: 'not run' },
        'd.evi': { zh: '證據', en: 'Evidence' },
        'verify.break': { zh: '故意改壞，測試要會抓到', en: 'Break it on purpose. The test has to catch it.' },
        'v.run': { zh: '跑驗證', en: 'Run checks' },
        'v.verifier': { zh: '驗證者', en: 'Verifier' },
        'v.indep': { zh: '不是寫程式的那幾個 AI', en: 'not one of the builders' },
        'v.test': { zh: '測試或指令', en: 'Test or command' },
        'v.out': { zh: '實際輸出', en: 'What it printed' },
        'v.cancel': { zh: '已取消的訂單不發通知', en: 'A cancelled order gets no notice' },
        'v.empty': { zh: '空的', en: 'empty' },
        'v.hollow': { zh: '綠了，但什麼都沒測', en: 'Green, and it tests nothing' },
        'v.broken': { zh: '故意改壞', en: 'Broken on purpose' },
        'v.caught': { zh: '抓到了', en: 'Caught' },
        'v.brk': { zh: '改壞', en: 'broken' },
        'v.restored': { zh: '還原', en: 'Restored' },
        'v.proven': { zh: '證據齊全', en: 'All proven' },
        'd.merge': { zh: '整合', en: 'Land it' },
        'audit.scan': { zh: '連 AI 的記憶和每次載入的設定一起查', en: 'It also checks the AI’s memory and what every session loads.' },
        'audit.read': { zh: '拿程式對文件，找出說不通的地方', en: 'Check the docs against the code, and find what no longer holds.' },
        'audit.fix': { zh: '說錯的當場改，沒人用的歸檔', en: 'Fix what is false on the spot; archive what nothing uses.' },
        'land.merge': { zh: '四份任務的分支併回 main', en: 'The four task branches merge back into main.' },
        'a.docOld': { zh: '出貨時不通知客戶，只能自己查訂單', en: 'Orders ship with no notice to the customer.' },
        'a.docNew': { zh: '出貨時，訂單頁會出現一則站內通知', en: 'When an order ships, its page shows a notice.' },
        'a.memory': { zh: 'AI 的記憶', en: 'the AI’s memory' },
        'a.gone': { zh: '檔案已不在', en: 'file is gone' },
        'a.load': { zh: '每個 session 都載入', en: 'loaded by every session' },
        'a.bloat': { zh: '越來越長', en: 'keeps growing' },
        'a.five': { zh: '五個檢查', en: 'Five checks' },
        'a.run': { zh: '一起跑', en: 'Run all' },
        'a.c1': { zh: '失效的連結和路徑', en: 'Dead links and paths' },
        'a.c2': { zh: '落後程式的文件、講同一段程式的兩份文件', en: 'Docs behind their code; two docs on one file' },
        'a.c3': { zh: '沒人決定去留的檔', en: 'Files nobody decided about' },
        'a.c4': { zh: 'AI 的記憶引用了不在的檔', en: 'Memory notes citing files that are gone' },
        'a.c5': { zh: '每個 session 都載入的檔，和它們的 token', en: 'What every session loads, in tokens' },
        'a.n1': { zh: '沒有失效的', en: 'none dead' },
        'a.n2': { zh: '2 份落後 · 1 對說法不同', en: '2 behind · 1 pair disagree' },
        'a.n3': { zh: '3 個未追蹤', en: '3 untracked' },
        'a.n4': { zh: '1 則引用不在的檔', en: '1 cites a missing file' },
        'a.reader': { zh: '讀者', en: 'Reader' },
        'a.readNote': { zh: '文件和它寫的那段程式，並排讀', en: 'reads each doc beside the code it describes' },
        'a.says': { zh: '文件說', en: 'doc says' },
        'a.does': { zh: '程式做', en: 'code does' },
        'a.no': { zh: '出貨時不通知', en: 'no notice on shipping' },
        'a.yes': { zh: '出貨時通知', en: 'a notice on shipping' },
        'a.email': { zh: '用 Email 寄', en: 'sent by email' },
        'a.inapp': { zh: '站內通知', en: 'in-app notice' },
        'a.sides': { zh: '程式站這邊', en: 'the code agrees' },
        'a.found': { zh: '發現', en: 'Findings' },
        'a.adv': { zh: '反方', en: 'Adversary' },
        'a.advNote': { zh: '每一條都試著推翻', en: 'tries to knock each one down' },
        'a.r1': { zh: '跟 orders/status.js:14 不符', en: 'contradicts orders/status.js:14' },
        'a.r2': { zh: '兩份說法不同', en: 'the two disagree' },
        'a.r3': { zh: 'orders/ship.js 已不在', en: 'orders/ship.js is gone' },
        'a.r4': { zh: '落後程式', en: 'behind its code' },
        'a.r4no': { zh: '程式只改了註解', en: 'only a comment changed' },
        'a.r5': { zh: '沒人引用', en: 'nothing uses it' },
        'a.r6': { zh: '同一段寫了兩次', en: 'says one thing twice' },
        'a.stands': { zh: '成立', en: 'Stands' },
        'a.defeat': { zh: '推翻', en: 'Defeated' },
        'a.one': { zh: '只留一個出處', en: 'one source' },
        'a.readmeOld': { zh: '出貨通知用 Email 寄出', en: 'Shipping notices go out by email' },
        'a.readmeNew': { zh: '出貨通知：見 docs/orders.md', en: 'Shipping notice: see docs/orders.md' },
        'a.done': { zh: '已處理', en: 'Handled' },
        'd.uses': { zh: '用到', en: 'uses' },
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
        S: S, V5: V5, t: t, rnd: rnd, inOut: inOut, decay: decay, hex: hex,
        field: field, shake: shake, word: word, wipeText: wipeText, popText: popText,
        ring: ring, burst: burst, flood: flood, stageFrame: stageFrame, PX: PX, PY: PY,
    };
    if (typeof window !== 'undefined') root.tourReelKit = module.exports;
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
