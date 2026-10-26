'use strict';
// assets/station/settings-page.js — 設定 `#/settings`: the quick setup approved
// in .fankeel/build/2026-10-21-station-redesign/route-settings-quick.html
// (station-39). Five blocks, one a screen; every question starts on the
// recommendation GET station/suggest?project= answers (the author's defaults
// until it does, or when the page is not served), tagged 依你的紀錄 or 作者推薦
// with the evidence in a tip; 全部套用推薦; a final screen of old -> new, the
// project's file and this machine's apart, commit.format behind a checkbox;
// 寫入 posts /profile once a scope. `#/settings/detail…` goes to
// w.FK_SETDETAIL. The question table, the key names, cur/lab/optHtml and the
// post are shared with settings-detail.js through FK_SETTINGS. The poll does
// not repaint #/settings (station.js), so the page redraws on its own events
// (a click, change or keydown, station/suggest answering, a write finishing).
(function (w, doc) {
    var EN = {
        'sq.bLand': 'How changes land', 'sq.bParallel': 'How much runs at once', 'sq.bCtx': 'Main thread and reports',
        'sq.bVerify': 'Verification and cost', 'sq.bAway': 'Away from the computer',
        'sq.riskPush': 'pushes to the remote', 'sq.cost': 'costs more',
        'sq.mainR': 'How changes reach main', 'sq.mainT': 'How do your changes reach main?',
        'sq.mainY': 'Nothing warns you when this is wrong, so it comes first. The three branch answers open a worktree for each task.',
        'sq.mainSkip': 'A PR always pushes and a kept branch never does, so push is not asked.',
        'sq.mainTip': 'git: {local} local merges, {pr} pull requests',
        'sq.mainFrom': 'Source: task.js profile suggest (git log --merges, the registered land records)',
        'sq.mainDirect': 'Commit straight on the current branch', 'sq.mainDirectE': 'No branch; land merges nothing', 'sq.mainDirectS': 'commit directly',
        'sq.mainMerge': 'Branch, merge back locally', 'sq.mainMergeE': 'A worktree per task, merged at land', 'sq.mainMergeS': 'local merge',
        'sq.mainPr': 'Branch and open a PR, merged after review', 'sq.mainPrE': 'Pushed and a PR opened at land', 'sq.mainPrS': 'open a PR',
        'sq.mainKeep': 'Keep the branch, I integrate', 'sq.mainKeepE': 'Land leaves the branch alone', 'sq.mainKeepS': 'keep the branch',
        'sq.pushR': 'Push or not', 'sq.pushT': 'Once merged back, push to the remote?',
        'sq.pushY': 'A push cannot be taken back. Not asked when the answer above is a PR or a kept branch.',
        'sq.pushTip': 'git: {unpushed} commits are on no remote',
        'sq.pushFrom': 'Source: task.js profile suggest (git log --not --remotes, the registered land records)',
        'sq.pushTrue': 'Push', 'sq.pushTrueE': 'Pushed after land, never asked', 'sq.pushTrueS': 'push',
        'sq.pushFalse': 'No, I push myself', 'sq.pushFalseE': 'Commits stay on this machine', 'sq.pushFalseS': 'no push',
        'sq.pushAsk': 'Ask me each time', 'sq.pushAskE': 'Asked at land', 'sq.pushAskS': 'ask each time',
        'sq.sessR': 'Sessions at once', 'sq.sessT': 'How many sessions do you open on one repo at once?',
        'sq.sessY': 'Two sessions overwriting each other is silent; different worktrees do not clash. The value is fixed when a task starts.',
        'sq.sessTip': '{n} sessions: two or more at once {share}% of the time, at most {peak} at once',
        'sq.sessFrom': 'Source: how the started and ended of each session in .fankeel/sessions overlap',
        'sq.sessWt': 'The branch answers already open a worktree per task; clashes happen almost only in one checkout.',
        'sq.sessOne': 'Usually one', 'sq.sessOneE': 'Rarely clashes; asks you when one file is shared', 'sq.sessOneS': 'one',
        'sq.sessSome': 'Two or three now and then', 'sq.sessSomeE': 'Stops and asks you when one file is shared', 'sq.sessSomeS': 'two or three',
        'sq.sessMany': 'Several, routinely', 'sq.sessManyE': 'Every task gets its own worktree; a clash is blocked', 'sq.sessManyS': 'several',
        'sq.inflR': 'Agents at once', 'sq.inflT': 'How many agents may one reply dispatch at once?',
        'sq.inflY': 'More agents than this from one reply and it stops to ask. It guards API usage, the main context and file clashes in a shared checkout, not the CPU.',
        'sq.inflTip': 'dispatch.inflight is {now} in .fankeel/profile.json',
        'sq.inflFrom': 'Source: dispatch.inflight in .fankeel/profile.json (8 when unset)',
        'sq.inflE': 'At most {n} in one reply; past that it asks',
        'sq.inflNo': 'No limit', 'sq.inflNoE': 'Never asks, however many; watch API usage and file clashes yourself',
        'sq.inflMin': 'Minimum', 'sq.inflRec': 'Suggested',
        'sq.ctxR': 'Stages handed off', 'sq.ctxT': 'On a long task, should the main thread keep the detail?',
        'sq.ctxY': 'A handed-off stage runs in a clean context; the main thread receives only paths and gates.',
        'sq.ctxTip': 'Most of the {n} recent tasks that recorded their settings ran this way',
        'sq.ctxFrom': 'Source: stage.agents in .fankeel/profile.json, the profile in .fankeel/sessions',
        'sq.ctxNone': 'Keep it, every stage in the main thread', 'sq.ctxNoneE': 'Clearest to follow; the context keeps growing', 'sq.ctxNoneS': 'keep the detail',
        'sq.ctxRw': 'Hand off reading and doing', 'sq.ctxRwE': 'survey, build and verify open a clean context',
        'sq.ctxAll': 'Hand off everything', 'sq.ctxAllE': 'The main thread only passes paths; good from a phone',
        'sq.langR': 'Report language', 'sq.langT': 'What language do handed-off stages write reports and gates in?',
        'sq.langY': 'Stage agents use it for reports and gates; with no stage handed off almost nothing reads it. Unset is English.',
        'sq.langTip': 'model.lang is already {lang}',
        'sq.langFrom': 'Source: model.lang in .fankeel/profile.json, ui.lang on this machine',
        'sq.langZh': 'Traditional Chinese', 'sq.langZhE': 'The same as this conversation', 'sq.langEnE': 'What unset means',
        'sq.langOther': 'Another language', 'sq.langOtherE': 'Type the language name', 'sq.langOtherS': 'other',
        'sq.langName': 'Language name', 'sq.langPh': 'Japanese',
        'sq.gatesR': 'Stages to pass', 'sq.gatesT': 'How many stages must a change pass to be done?',
        'sq.gatesY': 'This is the route a task takes when started without a class. No spike: it runs no verify and no land; start one with --class spike.',
        'sq.gatesTip': 'Tasks here default to class {cls}',
        'sq.gatesFrom': 'Source: task.js profile suggest, class.default in .fankeel/profile.json',
        'sq.gatesSurvey': 'Let survey decide from the task', 'sq.gatesSurveyE': 'Starts from 7 stages, trimmed to the task', 'sq.gatesSurveyS': 'survey decides',
        'sq.gatesBounded': 'Design, build, verify, land', 'sq.gatesBoundedE': 'Every task runs verify; no plan', 'sq.gatesBoundedS': '5 stages',
        'sq.gatesArch': 'All 7 stages', 'sq.gatesArchE': 'A plan and an audit every time; agents at least opus', 'sq.gatesArchS': '7 stages',
        'sq.floorR': 'Agents: cheap or steady', 'sq.floorT': 'Should dispatched agents save money or play safe?',
        'sq.floorY': 'Agents means implementers, readers and reviewers; the mockup model is not this. A wrong pick costs money, which you can see and change any time.',
        'sq.floorTip': 'dispatch.floor is already {floor}',
        'sq.floorFrom': 'Source: dispatch.floor in .fankeel/profile.json',
        'sq.floorHaiku': 'Save: haiku for small work', 'sq.floorHaikuE': 'Cheapest; complex work may suffer', 'sq.floorHaikuS': 'save',
        'sq.floorSonnet': 'Balanced', 'sq.floorSonnetE': 'At least sonnet; architectural raises to opus',
        'sq.floorOpus': 'Steady: opus and above', 'sq.floorOpusE': 'About twice the cost', 'sq.floorOpusS': 'steady',
        'sq.screenR': 'Mockups or not', 'sq.screenT': 'Does this repo have screens?',
        'sq.screenY': 'Asked only when a frontend is found. Mockups are always drawn by opus or above.',
        'sq.screenTip': 'design.mockup is already {mockup}',
        'sq.screenFrom': 'Source: git ls-files, design.mockup in .fankeel/profile.json',
        'sq.screenNo': 'No, nothing to draw', 'sq.screenNoE': 'The design stage draws no page', 'sq.screenNoS': 'no mockup',
        'sq.screenAsk': 'Yes, ask me each time', 'sq.screenAskE': 'Frontend work asks before drawing a mockup', 'sq.screenAskS': 'ask, then draw',
        'sq.screenAuto': 'Yes, just draw', 'sq.screenAutoE': 'Draws without asking and opens the page', 'sq.screenAutoS': 'draw',
        'sq.whereR': 'Where you are at a gate', 'sq.whereT': 'Where are you, mostly, when a gate waits for you?',
        'sq.whereY': 'Mostly friction. Away also writes this machine\'s settings, shown first and confirmed apart.',
        'sq.whereTip': '{from} is already set this way',
        'sq.whereFrom': 'Source: this machine\'s profile.json (notify.gate), gate.station and gate.away in .fankeel/profile.json',
        'sq.whereTerm': 'At the terminal', 'sq.whereTermE': 'Asked right in the terminal', 'sq.whereTermS': 'at the terminal',
        'sq.whereStation': 'The station open beside me', 'sq.whereStationE': 'A gate waits on the station for 2 minutes first', 'sq.whereStationS': 'station open',
        'sq.whereAway': 'Often away, on my phone', 'sq.whereAwayE': 'Works to the next decision of yours, compacts and stops', 'sq.whereAwayS': 'often away',
        'sq.whereAwayN': 'You will also be asked whether to write this machine\'s push and phone remote.',
        'sq.tipRaw': 'Record: {facts}', 'sq.tipNone': 'Recommendations are unavailable right now; this is the fankeel default', 'sq.srcNone': 'No recommendation', 'sq.tipAuthor': 'fankeel default; not enough record to go on',
        'sq.srcRec': 'From your record', 'sq.srcAuthor': 'Author\'s pick', 'sq.srcMine': 'Your pick', 'sq.rec': 'Recommended',
        'sq.whyAsk': 'Why this is asked', 'sq.typed': '(what you type)', 'sq.notSet': '(unset)', 'sq.unset': 'unset',
        'sq.nInteg': 'Into main', 'sq.nPush': 'Push to remote', 'sq.nArchive': 'Archive the plan', 'sq.nCommit': 'Commit format',
        'sq.nWorktree': 'Open a worktree', 'sq.nGuard': 'On a clash', 'sq.nInflight': 'Agents at once', 'sq.nClass': 'Stages to pass',
        'sq.nFloor': 'Agent model', 'sq.nJudge': 'Judge model', 'sq.nAgents': 'Stages handed off', 'sq.nLang': 'Report language',
        'sq.nGateStation': 'Gate waits on the station', 'sq.nGateAway': 'Before leaving', 'sq.nMockup': 'Draw mockups',
        'sq.nNotifyGate': 'Gate push', 'sq.nRemote': 'Phone remote',
        'sq.vMerge': 'local merge', 'sq.vPr': 'open a PR', 'sq.vKeep': 'keep the branch', 'sq.vWtNo': 'none', 'sq.vWtBounded': 'bounded and up',
        'sq.vWtAll': 'always', 'sq.vAsk': 'ask you', 'sq.vDeny': 'block', 'sq.vWarn': 'warn only', 'sq.vNoWait': 'no wait', 'sq.v2m': '2 min',
        'sq.v5m': '5 min', 'sq.vHint': 'hint', 'sq.vAskOne': 'one more question', 'sq.vArchive': 'archive', 'sq.vKeepPlan': 'keep', 'sq.vOn': 'on', 'sq.vOff': 'off',
        'sq.mNow': 'This machine now: {v}', 'sq.mcH': 'Also write to this machine', 'sq.thisMachine': 'This machine',
        'sq.mcWhy': 'Written to {file}. Only the machine settings are read for these two; the project file has no effect. Written only after you confirm.',
        'sq.mcAsk': 'What this card writes', 'sq.mcGate': 'Push to my phone when a gate waits', 'sq.mcRemote': 'Reach the station from my phone',
        'sq.remoteNote': 'Through Tailscale by default; Cloudflare Tunnel + Access is a later advanced option, not supported yet.',
        'sq.mcOk': 'Confirm, write to this machine', 'sq.mcNot': 'Not now',
        'sq.mcYes': 'Written to this machine along with the rest.', 'sq.mcSame': 'This machine is already set so; nothing is rewritten.',
        'sq.mcNo': 'This machine keeps its settings.', 'sq.mcBoth': 'Both are already on on this machine.',
        'sq.finG': '{g} · {n} items', 'sq.gProject': 'Project',
        'sq.finMNot': 'Not written: where you are at a gate is not away.', 'sq.finMPend': 'Not confirmed yet.',
        'sq.finMBack': 'Confirm under Away from the computer', 'sq.finMNo': 'Not written: you chose not now under Away from the computer.',
        'sq.finMSame': 'Nothing to write: push and the phone remote are already on here.', 'sq.finSame': 'The same as now; nothing to change.',
        'sq.cfFrom': 'the commit format in git', 'sq.from': 'From: {r}', 'sq.to': 'becomes',
        'sq.finT': 'Write these changes?', 'sq.finY': 'Only Write touches profile.json. The project and this machine are written apart; a value already set is not rewritten.',
        'sq.finAsk': 'What is written', 'sq.cfL': 'Also check the first line of each commit',
        'sq.cfTip': 'Recent first lines in git mostly follow this format', 'sq.cfSrc': 'Source: task.js profile suggest (git log --no-merges -n 50)',
        'sq.cfN': 'Unticked, nothing is written. The format from git had no merge; it is added here, or it would block land.js merge.',
        'sq.finN': 'Settings not asked here (sensitive-data review, agents at once, push server...) keep their values.',
        'sq.more': 'Adjust one by one? ', 'sq.detail': 'Open the detailed settings', 'sq.detailS': 'One screen a setting, adjusted one at a time',
        'sq.wrote': 'Wrote {n} items.', 'sq.failP': 'Writing the project settings failed; nothing there was saved.',
        'sq.failM': 'Writing this machine\'s settings failed; nothing there was saved.',
        'sq.unserved': 'This page was not opened through the station server, so it cannot write.',
        'sq.stripMine': 'You changed {n} recommendations', 'sq.stripAll': 'Every question starts on a recommendation',
        'sq.stripSub': '{r} from your record, {a} the author\'s pick; {tail}', 'sq.stripBack': 'the button on the right puts them all back',
        'sq.stripFinal': 'below is what the recommendations change', 'sq.stripHover': 'hover a tag for the evidence',
        'sq.all': 'Apply every recommendation', 'sq.allDone': 'Recommendations applied',
        'sq.toFinal': 'Check and write', 'sq.next': 'Next: {n}', 'sq.prev': 'Previous', 'sq.writing': 'Writing...', 'sq.wroteAll': 'Written',
        'sq.writeN': 'Write {n} items', 'sq.nothing': 'Nothing to write', 'sq.posFinal': 'Check before writing', 'sq.pos': 'Group {i} of {n}',
        'sq.railH': 'Quick setup', 'sq.railS': '5 groups · about 1 minute', 'sq.railIx': 'Groups of the quick setup',
        'sq.nChg': '{n} changes', 'sq.noChg': 'No changes', 'sq.proj': 'Project',
        'sq.noProject': 'No project to set up yet: start a fankeel task in a project first.', 'sq.noDetail': 'The detailed settings are not loaded.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }

    var MACHINE = ['station.remote', 'notify.gate', 'notify.stage', 'notify.end', 'notify.server', 'phone.hold', 'ui.lang', 'station.chartroom', 'quota.week'];
    var AUTHOR = { main: 'merge', push: 'false', sessions: 'some', inflight: '8', ctx: 'rw', lang: 'en', gates: 'survey', floor: 'sonnet', screen: 'opus', where: 'term' };
    // model.lang's value is the language's own name, written untranslated; spelt in code points
    // because a Chinese literal outside loc() fails stringsLeft (tests/station-module.js).
    var ZH = String.fromCharCode(0x7e41, 0x9ad4, 0x4e2d, 0x6587);
    var ORDER = ['land', 'parallel', 'ctx', 'verify', 'away', 'final'];
    var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>';
    var WARN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3M8 11.3v.01"/></svg>';
    var SAVE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 2.5v3h4v-3M5.5 13.5V9.5h5v4"/></svg>';
    var ARROW = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5"/></svg>';
    var CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';

    // One answer: o its id, t label, e effect, s the short form (rail, lab), w the keys it writes
    // ('$in' = what is typed, '' = unset); x adds risk (text), cost, note, input.
    function O(o, t, e, s, wr, x) {
        var r = { o: o, t: t, e: e, s: s || t, w: wr };
        if (x) for (var k in x) if (has(x, k)) r[k] = x[k];
        return r;
    }
    // dispatch.inflight's slider: a stop for each of 1..20, then one past 20 for no limit. Each
    // stop is an answer like any other, so the plan, the rail and the recommendation need nothing new.
    var INFL_MAX = 20;
    function stops() {
        var out = [];
        for (var n = 1; n <= INFL_MAX; n++) {
            out.push(O(String(n), String(n), loc('sq.inflE', '一次最多 {n} 個；超過就先問', { n: n }), null, { 'dispatch.inflight': String(n) }));
        }
        out.push(O('unlimited', loc('sq.inflNo', '無上限'), loc('sq.inflNoE', '再多也不問；API 用量與檔案衝突要自己留意'), null, { 'dispatch.inflight': 'unlimited' }));
        return out;
    }
    // The ten quick questions in screen order: id, b (block), cond ('push' | 'front'), r (short
    // name), title, why, tip (evidence with {vars} from the recommendation's v), from, skip, opts.
    function questions() {
        var push = loc('sq.riskPush', '推到遠端'), wt = loc('sq.sessWt', '開分支的答案已經替任務開 worktree，撞檔幾乎只發生在同一個 checkout。');
        return [
            { id: 'main', b: 'land', r: loc('sq.mainR', '怎麼進 main'), title: loc('sq.mainT', '你的改動怎麼進 main？'),
                why: loc('sq.mainY', '錯了不會有任何提示，所以排第一。開分支的三個答案會替任務開 worktree。'),
                skip: loc('sq.mainSkip', '發 PR 一律會推、分支留著一律不推，所以不問推不推。'),
                tip: loc('sq.mainTip', 'git 本機 merge {local} 次、PR {pr} 個'),
                from: loc('sq.mainFrom', '來源：task.js profile suggest（git log --merges、登錄的 land 紀錄）'), opts: [
                    O('direct', loc('sq.mainDirect', '直接 commit 在目前分支'), loc('sq.mainDirectE', '不開分支，收尾不用 merge'), loc('sq.mainDirectS', '直接 commit'), { worktree: 'false', 'land.integration': 'merge' }),
                    O('merge', loc('sq.mainMerge', '開分支，本機 merge 回來'), loc('sq.mainMergeE', '每個任務一個 worktree，收尾自動 merge'), loc('sq.mainMergeS', '本機 merge'), { worktree: 'bounded', 'land.integration': 'merge' }),
                    O('pr', loc('sq.mainPr', '開分支發 PR，review 過才合'), loc('sq.mainPrE', '收尾時推上去開 PR'), loc('sq.mainPrS', '發 PR'), { worktree: 'bounded', 'land.integration': 'pr', 'land.push': 'true' }, { risk: push }),
                    O('keep', loc('sq.mainKeep', '分支留著，我自己整合'), loc('sq.mainKeepE', '收尾時分支不動'), loc('sq.mainKeepS', '分支留著'), { worktree: 'bounded', 'land.integration': 'keep', 'land.push': 'false' })] },
            { id: 'push', b: 'land', cond: 'push', r: loc('sq.pushR', '推不推遠端'), title: loc('sq.pushT', '合回去之後，要推到遠端嗎？'),
                why: loc('sq.pushY', 'push 出去就收不回來。上一題選發 PR 或分支留著時不問。'),
                tip: loc('sq.pushTip', 'git 有 {unpushed} 個 commit 不在任何遠端'),
                from: loc('sq.pushFrom', '來源：task.js profile suggest（git log --not --remotes、登錄的 land 紀錄）'), opts: [
                    O('true', loc('sq.pushTrue', '推'), loc('sq.pushTrueE', '收尾完就 push，不再問'), loc('sq.pushTrueS', '推'), { 'land.push': 'true' }, { risk: push }),
                    O('false', loc('sq.pushFalse', '不推，我自己推'), loc('sq.pushFalseE', 'commit 留在本機'), loc('sq.pushFalseS', '不推'), { 'land.push': 'false' }),
                    O('ask', loc('sq.pushAsk', '每次問我'), loc('sq.pushAskE', '收尾時再問'), loc('sq.pushAskS', '每次問'), { 'land.push': '' })] },
            { id: 'sessions', b: 'parallel', r: loc('sq.sessR', '同時幾個 session'), title: loc('sq.sessT', '同一個 repo，你會同時開幾個 session？'),
                why: loc('sq.sessY', '兩個 session 互相蓋掉檔案是靜默的；不同 worktree 之間不算撞檔。這個值在任務開始時就固定。'),
                tip: loc('sq.sessTip', '{n} 個 session：{share}% 的時間同時開兩個以上，最多同時 {peak} 個'),
                from: loc('sq.sessFrom', '來源：.fankeel/sessions 每個 session 的 started 與 ended 重疊'), opts: [
                    O('one', loc('sq.sessOne', '通常一個'), loc('sq.sessOneE', '幾乎不會撞；撞到同一個檔時問你'), loc('sq.sessOneS', '一個'), { guard: 'ask' }, { note: wt }),
                    O('some', loc('sq.sessSome', '偶爾兩三個'), loc('sq.sessSomeE', '撞到同一個檔時停下來問你'), loc('sq.sessSomeS', '兩三個'), { guard: 'ask' }, { note: wt }),
                    O('many', loc('sq.sessMany', '常態好幾個'), loc('sq.sessManyE', '每個任務開自己的 worktree，撞檔直接擋'), loc('sq.sessManyS', '好幾個'), { worktree: 'true', guard: 'deny' })] },
            { id: 'inflight', b: 'parallel', r: loc('sq.inflR', '一次派幾個'), title: loc('sq.inflT', '一次最多同時派幾個 agent？'),
                why: loc('sq.inflY', '同一個回應派出的 Agent 超過這個數就先停下來問你。擋的是 API 用量、主對話 context 和共用 checkout 的檔案衝突，不是 CPU。'),
                tip: loc('sq.inflTip', '.fankeel/profile.json 的 dispatch.inflight 是 {now}'),
                from: loc('sq.inflFrom', '來源：.fankeel/profile.json 的 dispatch.inflight（不設時是 8）'), slider: true, opts: stops() },
            { id: 'ctx', b: 'ctx', r: loc('sq.ctxR', '交出去幾站'), title: loc('sq.ctxT', '長任務時，主對話要留著細節嗎？'),
                why: loc('sq.ctxY', '交出去的站在乾淨的 context 裡跑，主對話只收路徑和 gate。'),
                tip: loc('sq.ctxTip', '最近 {n} 個記下設定的任務多半這樣跑'),
                from: loc('sq.ctxFrom', '來源：.fankeel/profile.json 的 stage.agents、.fankeel/sessions 的 profile'), opts: [
                    O('none', loc('sq.ctxNone', '留著，每站都在主對話跑'), loc('sq.ctxNoneE', '看得最清楚；context 一路堆高'), loc('sq.ctxNoneS', '留細節'), { 'stage.agents': '' }),
                    O('rw', loc('sq.ctxRw', '讀和做交出去'), loc('sq.ctxRwE', 'survey、build、verify 另開乾淨 context'), null, { 'stage.agents': 'survey,build,verify' }),
                    O('all', loc('sq.ctxAll', '全部交出去'), loc('sq.ctxAllE', '主控只轉路徑；適合用手機遠端'), null, { 'stage.agents': 'survey,design,plan,build,verify,audit,land' })] },
            { id: 'lang', b: 'ctx', r: loc('sq.langR', '報告語言'), title: loc('sq.langT', '交出去的站，報告和 gate 用什麼語言？'),
                why: loc('sq.langY', '站 agent 寫報告和 gate 時用；沒有交出去的站時，幾乎沒有東西讀它。不設是英文。'),
                tip: loc('sq.langTip', 'model.lang 已經是 {lang}'),
                from: loc('sq.langFrom', '來源：.fankeel/profile.json 的 model.lang、這台機器的 ui.lang'), opts: [
                    O('zh', loc('sq.langZh', '繁體中文'), loc('sq.langZhE', '跟這段對話一樣'), null, { 'model.lang': ZH }),
                    O('en', 'English', loc('sq.langEnE', '不設時就是英文'), null, { 'model.lang': '' }),
                    O('other', loc('sq.langOther', '其他語言'), loc('sq.langOtherE', '填語言名稱'), loc('sq.langOtherS', '其他'), { 'model.lang': '$in' }, { input: true })] },
            { id: 'gates', b: 'verify', r: loc('sq.gatesR', '過幾關'), title: loc('sq.gatesT', '一個改動要過幾關才算完成？'),
                why: loc('sq.gatesY', '定的是起任務沒說類別時走哪條路線。沒有 spike：它不跑 verify 也不 land，要時起任務加 --class spike。'),
                tip: loc('sq.gatesTip', '這裡的任務預設類別是 {cls}'),
                from: loc('sq.gatesFrom', '來源：task.js profile suggest、.fankeel/profile.json 的 class.default'), opts: [
                    O('survey', loc('sq.gatesSurvey', '讓 survey 看任務決定'), loc('sq.gatesSurveyE', '從 7 站開始，依任務縮減'), loc('sq.gatesSurveyS', 'survey 決定'), { 'class.default': '' }),
                    O('bounded', loc('sq.gatesBounded', '設計 → 實作 → 驗證 → 收尾'), loc('sq.gatesBoundedE', '每個任務都跑 verify，不寫 plan'), loc('sq.gatesBoundedS', '5 站'), { 'class.default': 'bounded' }),
                    O('arch', loc('sq.gatesArch', '全部 7 站'), loc('sq.gatesArchE', '每個都有 plan 和 audit，子代理至少 opus'), loc('sq.gatesArchS', '7 站'), { 'class.default': 'architectural', 'land.archivePlan': 'true' }, { cost: true })] },
            { id: 'floor', b: 'verify', r: loc('sq.floorR', '子代理省或穩'), title: loc('sq.floorT', '派出去的子代理，寧可省還是穩？'),
                why: loc('sq.floorY', '子代理指實作、閱讀、review；mockup 的模型不歸這題管。錯了的代價是錢，看得到，也隨時能改。'),
                tip: loc('sq.floorTip', 'dispatch.floor 已經是 {floor}'),
                from: loc('sq.floorFrom', '來源：.fankeel/profile.json 的 dispatch.floor'), opts: [
                    O('haiku', loc('sq.floorHaiku', '省：小事用 haiku'), loc('sq.floorHaikuE', '最便宜；複雜任務品質可能下降'), loc('sq.floorHaikuS', '省'), { 'dispatch.floor': 'haiku', 'judge.model': 'opus' }),
                    O('sonnet', loc('sq.floorSonnet', '平衡'), loc('sq.floorSonnetE', '至少 sonnet，架構級自動提到 opus'), null, { 'dispatch.floor': 'sonnet', 'judge.model': 'fable' }),
                    O('opus', loc('sq.floorOpus', '穩：一律 opus 以上'), loc('sq.floorOpusE', '花費約翻倍'), loc('sq.floorOpusS', '穩'), { 'dispatch.floor': 'opus', 'judge.model': 'fable' }, { cost: true })] },
            { id: 'screen', b: 'verify', cond: 'front', r: loc('sq.screenR', '畫不畫 mockup'), title: loc('sq.screenT', '這個 repo 有畫面嗎？'),
                why: loc('sq.screenY', '偵測到前端才問。mockup 固定用 opus 以上畫。'),
                tip: loc('sq.screenTip', 'design.mockup 已經是 {mockup}'),
                from: loc('sq.screenFrom', '來源：git ls-files、.fankeel/profile.json 的 design.mockup'), opts: [
                    O('false', loc('sq.screenNo', '沒有／不用畫'), loc('sq.screenNoE', 'design 站不畫頁面'), loc('sq.screenNoS', '不畫'), { 'design.mockup': 'false' }),
                    O('opus', loc('sq.screenAsk', '有，每次先問我'), loc('sq.screenAskE', '前端工作先問要不要畫 mockup'), loc('sq.screenAskS', '先問再畫'), { 'design.mockup': 'opus' }, { cost: true }),
                    O('auto', loc('sq.screenAuto', '有，直接畫'), loc('sq.screenAutoE', '不問就畫，畫完打開頁面'), loc('sq.screenAutoS', '直接畫'), { 'design.mockup': 'auto' }, { cost: true })] },
            { id: 'where', b: 'away', r: loc('sq.whereR', 'gate 等你時你在哪'), title: loc('sq.whereT', 'gate 等你的時候，你多半在哪？'),
                why: loc('sq.whereY', '大多只是摩擦。選「常離開」還要寫這台機器的設定，會先給你看，再另外確認。'),
                tip: loc('sq.whereTip', '{from} 已經這樣設'),
                from: loc('sq.whereFrom', '來源：這台機器的 profile.json（notify.gate）、.fankeel/profile.json 的 gate.station 與 gate.away'), opts: [
                    O('term', loc('sq.whereTerm', '就在 terminal 前'), loc('sq.whereTermE', '直接在 terminal 問'), loc('sq.whereTermS', 'terminal 前'), { 'gate.station': 'off', 'gate.away': 'hint' }),
                    O('station', loc('sq.whereStation', '旁邊開著監控站'), loc('sq.whereStationE', 'gate 先在監控站等你 2 分鐘'), loc('sq.whereStationS', '開著監控站'), { 'gate.station': '120', 'gate.away': 'hint' }),
                    O('away', loc('sq.whereAway', '常離開，用手機看'), loc('sq.whereAwayE', '做到下一個要你決定的地方，壓縮後停'), loc('sq.whereAwayS', '常離開'), { 'gate.station': '300', 'gate.away': 'ask' },
                        { note: loc('sq.whereAwayN', '另外會問要不要寫這台機器的推播與手機遠端。') })] },
        ];
    }
    function blocks() {
        return [{ id: 'land', n: loc('sq.bLand', '改動怎麼收') }, { id: 'parallel', n: loc('sq.bParallel', '同時跑多少') }, { id: 'ctx', n: loc('sq.bCtx', '主對話與報告') },
            { id: 'verify', n: loc('sq.bVerify', '驗證與成本') }, { id: 'away', n: loc('sq.bAway', '離開電腦時') }];
    }
    // A key's short name on the write screen: NAME(k), a key not listed showing as itself, or
    // NAME[k] for the listed ones (copied on at load; i18n.js has picked the language by then).
    function names() {
        return { 'land.integration': loc('sq.nInteg', '怎麼進 main'), 'land.push': loc('sq.nPush', '推不推遠端'), 'land.archivePlan': loc('sq.nArchive', '計畫封存'),
            'commit.format': loc('sq.nCommit', 'commit 格式'), worktree: loc('sq.nWorktree', '開 worktree'), guard: loc('sq.nGuard', '撞檔時'),
            'dispatch.inflight': loc('sq.nInflight', '一次派幾個'), 'class.default': loc('sq.nClass', '過幾關'), 'dispatch.floor': loc('sq.nFloor', '子代理模型'),
            'judge.model': loc('sq.nJudge', '判官模型'), 'stage.agents': loc('sq.nAgents', '交出去的站'), 'model.lang': loc('sq.nLang', '報告語言'),
            'gate.station': loc('sq.nGateStation', 'gate 頁等你'), 'gate.away': loc('sq.nGateAway', '離開前'), 'design.mockup': loc('sq.nMockup', '畫 mockup'),
            'notify.gate': loc('sq.nNotifyGate', 'gate 推播'), 'station.remote': loc('sq.nRemote', '手機遠端') };
    }
    function NAME(k) { var N = names(); return has(N, k) ? N[k] : k; }
    (function () { var N = names(); for (var k in N) if (has(N, k)) NAME[k] = N[k]; }());
    // A value's label: the name of a value the answers share (guard, worktree, gate.*), else
    // the short form of the first answer writing only k=v, else '' as 未設 and anything else raw.
    function lab(k, v) {
        v = v == null ? '' : String(v);
        var onOff = { 'true': loc('sq.vOn', '開'), 'false': loc('sq.vOff', '關') };
        var X = { 'land.integration': { merge: loc('sq.vMerge', '本機 merge'), pr: loc('sq.vPr', '發 PR'), keep: loc('sq.vKeep', '分支留著') },
            worktree: { 'false': loc('sq.vWtNo', '不開'), bounded: loc('sq.vWtBounded', 'bounded 以上'), 'true': loc('sq.vWtAll', '一律') },
            guard: { ask: loc('sq.vAsk', '問你'), deny: loc('sq.vDeny', '擋下'), off: loc('sq.vWarn', '只警告') },
            'gate.station': { off: loc('sq.vNoWait', '不等'), '120': loc('sq.v2m', '2 分'), '300': loc('sq.v5m', '5 分') },
            'gate.away': { hint: loc('sq.vHint', '提示'), ask: loc('sq.vAskOne', '多問一題') },
            'land.archivePlan': { 'true': loc('sq.vArchive', '封存'), 'false': loc('sq.vKeepPlan', '留著') },
            'notify.gate': onOff, 'station.remote': onOff };
        if (has(X, k) && has(X[k], v)) return X[k][v];
        var qs = questions();
        for (var i = 0; i < qs.length; i++) {
            for (var j = 0; j < qs[i].opts.length; j++) {
                var wr = qs[i].opts[j].w, ks = Object.keys(wr);
                if (ks.length === 1 && ks[0] === k && wr[k] === v) return qs[i].opts[j].s;
            }
        }
        return v === '' ? loc('sq.unset', '未設') : v;
    }

    // ---- what is set: S's profile values plus what this page wrote since ----
    var over = {};
    function str(v) {
        if (v == null) return '';
        if (Object.prototype.toString.call(v) === '[object Array]') return v.join(',');
        return String(v);
    }
    // The value of k as a string, the project's merged values for dir or the machine's for a
    // falsy dir; a value this page wrote wins until S's next read shows the same.
    function cur(S, dir, k) {
        var P = (S && S.profiles) || {}, box = dir ? (P.projects && P.projects[dir]) : P.machine;
        var have = str(box && box.values ? box.values[k] : null), o = over[dir || ''];
        if (o && has(o, k)) {
            if (o[k] !== have) return o[k];
            delete o[k];
        }
        return have;
    }
    // POST /profile for one scope: o = { scope: 'project' | 'machine', project: dir }, rows
    // [{ k, to }]; done(ok). Unserved, it answers false without asking.
    function post(S, o, rows, done) {
        if (!S || !S.serve || typeof fetch !== 'function' || !rows.length) { done(false); return; }
        var form = new URLSearchParams();
        form.set('nonce', S.nonce || '');
        form.set('scope', o.scope);
        if (o.scope === 'project') form.set('project', o.project);
        rows.forEach(function (r) { form.append('key', r.k); form.append('value', String(r.to)); });
        fetch('profile', { method: 'POST', body: form }).then(function (res) {
            var ok = Boolean(res && res.ok), key = o.scope === 'machine' ? '' : o.project;
            if (ok) rows.forEach(function (r) { (over[key] = over[key] || {})[r.k] = String(r.to); });
            done(ok);
        }, function () { done(false); });
    }

    // ---- the quick page's state, one project at a time ----
    function fresh(dir) {
        var ans = {};
        for (var k in AUTHOR) if (has(AUTHOR, k)) ans[k] = AUTHOR[k];
        return { dir: dir, at: 'land', ans: ans, inp: {}, seen: {}, mk: { 'notify.gate': true, 'station.remote': true },
            mc: '', cf: false, wrote: 0, busy: false, err: '', sug: null, sugErr: false, asked: false };
    }
    var st = fresh(null), last = null, lastS = null, bound = false;
    function optOf(q, o) { for (var i = 0; i < q.opts.length; i++) if (q.opts[i].o === o) return q.opts[i]; return null; }
    // The recommendation for q: station/suggest's when it named an answer q has, else the author's.
    function rec(q) {
        var r = st.sug && st.sug.recs && st.sug.recs[q.id];
        if (r && optOf(q, String(r.o))) return { o: String(r.o), src: r.src === 'rec' ? 'rec' : 'author', v: r.v || {} };
        return { o: AUTHOR[q.id], src: 'author', v: {} };
    }
    function applies(q) {
        if (q.cond === 'push') return st.ans.main === 'direct' || st.ans.main === 'merge';
        if (q.cond === 'front') return Boolean(st.sug && st.sug.front);
        return true;
    }
    function cfv() { return st.sug && typeof st.sug.commitFormat === 'string' ? st.sug.commitFormat : ''; }
    function plan(qs) {
        var P = {};
        qs.forEach(function (q) {
            var a = applies(q) ? optOf(q, st.ans[q.id]) : null;
            if (!a) return;
            Object.keys(a.w).forEach(function (k) {
                var v = a.w[k];
                if (v === '$in') { v = String(st.inp[q.id] || '').trim(); if (!v) return; }
                P[k] = { v: v, by: q.id };
            });
        });
        return P;
    }
    function changes(S, qs) {
        var P = plan(qs), out = [];
        Object.keys(P).forEach(function (k) {
            var from = cur(S, st.dir, k);
            if (P[k].v !== from) out.push({ k: k, from: from, to: P[k].v, by: P[k].by });
        });
        var cf = cfv();
        if (st.cf && cf && cur(S, st.dir, 'commit.format') !== cf) out.push({ k: 'commit.format', from: cur(S, st.dir, 'commit.format'), to: cf, by: 'cf' });
        return out;
    }
    function machine(S) {
        if (st.ans.where !== 'away') return { want: false, rows: [], would: [] };
        var would = [];
        ['notify.gate', 'station.remote'].forEach(function (k) {
            if (st.mk[k] && cur(S, null, k) !== 'true') would.push({ k: k, from: cur(S, null, k) || 'false', to: 'true', by: 'where' });
        });
        return { want: true, rows: st.mc === 'yes' ? would : [], would: would };
    }
    function total(S, qs) { return changes(S, qs).length + machine(S).rows.length; }
    function nChanged(qs) { return qs.filter(function (q) { return applies(q) && st.ans[q.id] !== rec(q).o; }).length; }
    function summary(qs, bid) {
        return qs.filter(function (q) { return q.b === bid && applies(q); }).map(function (q) {
            var a = optOf(q, st.ans[q.id]), typed = String(st.inp[q.id] || '').trim();
            return a && a.input && typed ? typed : a ? a.s : '';
        }).join(' · ');
    }
    function sepOf(p) { return String(p).indexOf('\\') >= 0 ? '\\' : '/'; }
    function projectFile(dir) { var s = sepOf(dir); return String(dir).replace(/[\\/]+$/, '') + s + '.fankeel' + s + 'profile.json'; }
    function machineFile(o) {
        var c = String((o && o.configDir) || ''), s = sepOf(c);
        return c ? c.replace(/[\\/]+$/, '') + s + 'fankeel' + s + 'profile.json' : 'profile.json';
    }
    // Ask station/suggest once a project; an answer moves only the questions still on the old recommendation.
    function ask(S) {
        if (st.asked || !st.dir || !S || !S.serve || typeof fetch !== 'function') return;
        st.asked = true;
        var dir = st.dir;
        fetch('station/suggest?project=' + encodeURIComponent(dir)).then(function (res) {
            return res && res.ok ? res.json() : null;
        }).then(function (j) {
            if (st.dir !== dir) return;
            if (!j) { st.sugErr = true; redraw(); return; }
            var qs = questions(), keep = {};
            qs.forEach(function (q) { keep[q.id] = st.ans[q.id] !== rec(q).o; });
            st.sug = j;
            qs.forEach(function (q) { if (!keep[q.id]) st.ans[q.id] = rec(q).o; });
            redraw();
        }, function () { if (st.dir === dir) { st.sugErr = true; redraw(); } });
    }

    // ---- drawing ----
    function helpHtml(id, inner, label) {
        return '<span class="v9-help"><button type="button" class="v9-qm" data-qm aria-label="' + esc(label) + '" aria-describedby="' + id + '" aria-expanded="false">?</button>'
            + '<span class="v9-tip" role="tooltip" id="' + id + '">' + inner + '</span></span>';
    }
    // A question's answers as the radiogroup the mockup draws; sel is the answer on, recO the
    // recommended one (null: none marked), inp the typed values by question, pre the id prefix.
    function optHtml(q, sel, recO, inp, pre) {
        pre = pre || 'qk';
        return '<div class="v9-opts qk-opts" role="radiogroup" aria-labelledby="' + pre + 'q-' + q.id + '">' + q.opts.map(function (a, i) {
            var on = a.o === sel, tid = pre + 'w-' + q.id + '-' + i;
            var codes = Object.keys(a.w).map(function (k) {
                var v = a.w[k] === '$in' ? loc('sq.typed', '（你填的值）') : a.w[k] === '' ? loc('sq.notSet', '（不設）') : a.w[k];
                return '<code>' + esc(k + ': ' + v) + '</code>';
            }).join('');
            return '<div class="v9-o' + (a.input ? ' has-in' : '') + '"><button type="button" class="v9-opt' + (a.o === recO ? ' is-rec' : '') + '" role="radio" aria-checked="' + on
                + '" tabindex="' + (on ? 0 : -1) + '" data-o="' + esc(a.o) + '" aria-describedby="' + tid + '"><span class="v9-radio" aria-hidden="true"></span><span class="v9-ot">' + esc(a.t)
                + (a.o === recO ? '<span class="v9-tag rec">' + CHECK + loc('sq.rec', '推薦') + '</span>' : '')
                + (a.risk ? '<span class="v9-risk">' + WARN + esc(a.risk) + '</span>' : '')
                + (a.cost ? '<span class="qk-cost">' + loc('sq.cost', '花費較高') + '</span>' : '')
                + '</span><span class="v9-oe">' + esc(a.e) + '</span></button>'
                + '<span class="v9-tip v9-wtip" role="tooltip" id="' + tid + '">' + codes + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</span>'
                + (a.input ? '<span class="qk-in" data-field="' + esc(a.o) + '"' + (on ? '' : ' hidden') + '><span class="v9-in"><input id="' + pre + 'i-' + q.id + '" data-in value="'
                    + esc((inp && inp[q.id]) || '') + '" aria-label="' + esc(loc('sq.langName', '語言名稱')) + '" placeholder="' + esc(loc('sq.langPh', '日本語'))
                    + '" autocomplete="off" spellcheck="false"></span></span>' : '')
                + '</div>';
        }).join('') + '</div>';
    }
    // A slider question's answers as one native range (arrow keys, Home and End come with it):
    // opts the stops, sel the answer on, id the input's id, lid the title it is labelled by. The
    // stop's own label and effect sit beside it; marks name 1, 4 (最低), 8 (建議) and the last.
    function sliderHtml(opts, sel, id, lid) {
        var at = -1, ix8 = 0;
        opts.forEach(function (a, i) { if (a.o === sel) at = i; if (a.o === '8') ix8 = i; });
        var a = opts[at < 0 ? ix8 : at], name = a.t || a.label;
        return '<div class="v9-slide" data-slider><p class="v9-sv"><output class="v9-sval" for="' + id + '">' + esc(name) + '</output><span class="v9-sef">' + esc(a.e || a.effect) + '</span></p>'
            + '<input type="range" class="v9-range" id="' + id + '" data-slide min="1" max="' + opts.length + '" step="1" value="' + ((at < 0 ? ix8 : at) + 1)
            + '" aria-labelledby="' + lid + '" aria-valuetext="' + esc(name) + '">'
            + '<div class="v9-marks"><span class="v9-mk m1">1</span><span class="v9-mk m4">' + esc(loc('sq.inflMin', '最低')) + ' 4</span><span class="v9-mk m8">'
            + esc(loc('sq.inflRec', '建議')) + ' 8</span><span class="v9-mk mu">' + esc(opts[opts.length - 1].t || opts[opts.length - 1].label) + '</span></div></div>';
    }
    // Move the readout with the thumb, without a redraw (that would drop the drag); the stop it is on.
    function slideSync(t, opts) {
        var a = opts[Number(t.value) - 1], box = t.closest('[data-slider]');
        if (!a || !box) return null;
        var name = a.t || a.label, o = box.querySelector('output'), e = box.querySelector('.v9-sef');
        t.setAttribute('aria-valuetext', name);
        if (o) o.textContent = name;
        if (e) e.textContent = a.e || a.effect;
        return a;
    }
    function srcHtml(q, r) {
        var isRec = r.src === 'rec', id = 'qks-' + q.id, b;
        if (!isRec) b = st.sugErr ? loc('sq.tipNone', '推薦暫時取不到，這是 fankeel 預設') : loc('sq.tipAuthor', 'fankeel 預設；沒有足夠的紀錄可以推');
        else {
            b = kit().fillVars(q.tip, r.v);
            if (/\{\w+\}/.test(b)) b = loc('sq.tipRaw', '紀錄：{facts}', { facts: Object.keys(r.v).map(function (x) { return x + ' ' + r.v[x]; }).join(' · ') });
        }
        return '<button type="button" class="qk-src ' + (isRec ? 'is-rec' : 'is-author') + '" data-qm aria-describedby="' + id + '" aria-expanded="false">'
            + (isRec ? loc('sq.srcRec', '依你的紀錄') : st.sugErr ? loc('sq.srcNone', '推薦取不到') : loc('sq.srcAuthor', '作者推薦')) + '</button>'
            + '<span class="v9-tip qk-stip" role="tooltip" id="' + id + '"><b>' + esc(b) + '</b><small>' + esc(q.from) + '</small></span>';
    }
    function qHtml(q) {
        if (!applies(q)) return '';
        var r = rec(q), skip = q.skip && st.ans.main !== 'direct' && st.ans.main !== 'merge';
        return '<div class="qk-q" data-block="quick-q-' + q.id + '" data-q="' + q.id + '"><div class="qk-qh"><h3 class="qk-qt" id="qkq-' + q.id + '">' + esc(q.title) + '</h3>'
            + srcHtml(q, r) + helpHtml('qkh-' + q.id, esc(q.why), loc('sq.whyAsk', '為什麼問這題')) + '</div>'
            + (q.slider ? sliderHtml(q.opts, st.ans[q.id], 'qkr-' + q.id, 'qkq-' + q.id) : optHtml(q, st.ans[q.id], r.o, st.inp, 'qk')) + (skip ? '<p class="qk-skip">' + esc(q.skip) + '</p>' : '') + '</div>';
    }
    function cardHtml(S, o) {
        if (st.ans.where !== 'away') return '';
        var m = machine(S), here = loc('sq.thisMachine', '這台機器');
        var now = function (k) {
            return '<span class="qk-mnow">' + esc(loc('sq.mNow', '這台機器現在：{v}', { v: cur(S, null, k) === 'true' ? loc('sq.vOn', '開') : loc('sq.vOff', '關') })) + '</span>';
        };
        var box = function (k, id, label) { return '<input type="checkbox" id="' + id + '" data-mk="' + k + '"' + (st.mk[k] ? ' checked' : '') + '><label for="' + id + '">' + esc(label) + '</label>'; };
        var say = st.mc === 'yes' ? (m.rows.length ? loc('sq.mcYes', '會在寫入時一起寫進這台機器。') : loc('sq.mcSame', '這台機器已經是這樣，寫入時不會重寫。'))
            : st.mc === 'no' ? loc('sq.mcNo', '這台機器維持現在的設定。') : m.would.length ? '' : loc('sq.mcBoth', '這台機器兩項都已經開著。');
        return '<div class="v9-mc qk-mc" data-block="quick-machine-card" data-state="' + st.mc + '" role="group" aria-labelledby="qkmc-h">'
            + '<div class="v9-mc-h"><b id="qkmc-h">' + loc('sq.mcH', '還要寫進這台機器') + '</b>'
            + helpHtml('qkh-mc', '<code>notify.gate: true<i> · ' + esc(here) + '</i></code><code>station.remote: true<i> · ' + esc(here) + '</i></code><small>'
                + esc(loc('sq.mcWhy', '寫進 {file}。這兩項只讀機器設定，寫在專案檔不會生效。要另外按確認才寫。', { file: machineFile(o) })) + '</small>', loc('sq.mcAsk', '這張卡寫什麼')) + '</div>'
            + '<ul class="v9-mc-l"><li>' + box('notify.gate', 'qkmc-n', loc('sq.mcGate', 'gate 等你時推播到手機')) + now('notify.gate') + '</li>'
            + '<li>' + box('station.remote', 'qkmc-r', loc('sq.mcRemote', '手機遠端連進監控站'))
            + now('station.remote')
            + '<span class="qk-mpend">' + loc('sq.remoteNote', '預設走 Tailscale；Cloudflare Tunnel + Access 是之後的進階選項，現在還不支援。') + '</span></li></ul>'
            + '<div class="v9-mc-f"><button type="button" class="v9-btn pri" data-mc="yes">' + loc('sq.mcOk', '確認，寫進這台機器') + '</button>'
            + '<button type="button" class="v9-btn" data-mc="no">' + loc('sq.mcNot', '先不要') + '</button><span class="v9-mc-say" role="status">' + esc(say) + '</span></div></div>';
    }
    function screenHtml(S, o, qs, b) {
        return '<div class="qk-screen" data-block="quick-b-' + b.id + '" data-screen="' + b.id + '"><h2 class="qk-bh" id="qkb-' + b.id + '" tabindex="-1">' + esc(b.n) + '</h2>'
            + qs.filter(function (q) { return q.b === b.id; }).map(qHtml).join('') + (b.id === 'away' ? cardHtml(S, o) : '') + '</div>';
    }
    function finalHtml(S, o, qs) {
        var ch = changes(S, qs), m = machine(S), by = {}, cf = cfv();
        qs.forEach(function (q) { by[q.id] = q; });
        var src = function (c) {
            if (c.by === 'cf') return loc('sq.srcRec', '依你的紀錄');
            var q = by[c.by], r = rec(q);
            if (st.ans[q.id] !== r.o) return loc('sq.srcMine', '你選的');
            return r.src === 'rec' ? loc('sq.srcRec', '依你的紀錄') : loc('sq.srcAuthor', '作者推薦');
        };
        var group = function (g, title, file, rows) {
            var h = '<div class="v9-fin-g"><p class="v9-fin-h"><b>' + esc(loc('sq.finG', '{g} · {n} 項', { g: title, n: rows.length })) + '</b><code title="' + esc(file) + '">' + esc(file) + '</code></p>';
            if (g === 'm' && !rows.length) {
                var t = !m.want ? loc('sq.finMNot', '不寫：gate 等你時的答案不是「常離開」。')
                    : st.mc === '' && m.would.length ? loc('sq.finMPend', '還沒確認。') + '<button type="button" data-go="away">' + loc('sq.finMBack', '回「離開電腦時」確認') + '</button>'
                        : st.mc === 'no' ? loc('sq.finMNo', '不寫：你在「離開電腦時」選了先不要。')
                            : loc('sq.finMSame', '不用寫：推播和手機遠端這台機器都已經開著。');
                return h + '<p class="qk-fin-m">' + t + '</p></div>';
            }
            if (!rows.length) return h + '<p class="qk-fin-m">' + loc('sq.finSame', '跟現在一樣，沒有要改的。') + '</p></div>';
            return h + '<ul class="v9-fin-l">' + rows.map(function (c, n) {
                var id = 'qkf-' + g + n, a = lab(c.k, c.from), z = lab(c.k, c.to);
                var whence = c.by === 'cf' ? loc('sq.cfFrom', 'git 紀錄的 commit 格式') : by[c.by].r;
                return '<li><span class="v9-fk" tabindex="0" aria-describedby="' + id + '">' + esc(NAME(c.k)) + '</span><span class="v9-tip" role="tooltip" id="' + id + '"><code>'
                    + esc(c.k + ': ' + (c.to === '' ? loc('sq.notSet', '（不設）') : c.to)) + '</code><small>' + esc(loc('sq.from', '來自：{r}', { r: whence })) + '</small></span>'
                    + '<span class="v9-chg"><s title="' + esc(a) + '">' + esc(a) + '</s><span aria-hidden="true">→</span><span class="hm-sr">' + loc('sq.to', '改成') + '</span>'
                    + '<b title="' + esc(z) + '">' + esc(z) + '</b></span><span class="qk-fin-src">' + esc(src(c)) + '</span></li>';
            }).join('') + '</ul></div>';
        };
        return '<div class="qk-screen" data-block="quick-final" data-screen="final"><div class="qk-fh"><h2 class="qk-bh" id="qkb-final" tabindex="-1">' + loc('sq.finT', '要寫入這些改動嗎？') + '</h2>'
            + helpHtml('qkh-final', loc('sq.finY', '按寫入才會動 profile.json。專案和這台機器分開寫；跟現在一樣的值不重寫。'), loc('sq.finAsk', '寫入什麼')) + '</div>'
            + '<div data-fin>' + group('p', loc('sq.gProject', '專案'), projectFile(st.dir), ch) + group('m', loc('sq.thisMachine', '這台機器'), machineFile(o), m.rows) + '</div>'
            + (st.wrote ? '<p class="v9-fin-ok" role="status">' + CHECK + '<span>' + esc(loc('sq.wrote', '已寫入 {n} 項。', { n: st.wrote })) + '</span></p>' : '')
            + (cf ? '<div class="qk-extra"><input type="checkbox" id="qk-cf" data-cf' + (st.cf ? ' checked' : '') + '><label for="qk-cf">' + loc('sq.cfL', '另外檢查 commit 第一行的格式') + '</label>'
                + '<button type="button" class="qk-src is-rec" data-qm aria-describedby="qks-cf" aria-expanded="false">' + loc('sq.srcRec', '依你的紀錄') + '</button>'
                + '<span class="v9-tip qk-stip" role="tooltip" id="qks-cf"><b>' + loc('sq.cfTip', 'git 近期的 commit 第一行大多照這個格式寫') + '</b><small>'
                + loc('sq.cfSrc', '來源：task.js profile suggest（git log --no-merges -n 50）') + '</small></span><code class="qk-cfv">' + esc(cf) + '</code>'
                + '<p class="qk-cfn">' + loc('sq.cfN', '不勾就不寫。git 推出的格式沒有 merge，這裡已經補上，不然會擋住 land.js merge。') + '</p></div>' : '')
            + '<p class="v9-fin-n">' + loc('sq.finN', '沒問到的設定（敏感資料審查、一次派幾個、推播伺服器⋯）維持現在的值。') + '</p>'
            + '<p class="qk-more">' + loc('sq.more', '要逐項調整？') + '<a href="#/settings/detail">' + loc('sq.detail', '進入詳細設定') + '</a></p>'
            + (S && S.serve ? '' : '<p class="qk-fin-m">' + loc('sq.unserved', '這頁不是經由監控站伺服器開的，不能寫入。') + '</p>')
            + (st.err ? '<p class="qk-fin-m" role="status">' + esc(st.err) + '</p>' : '')
            + '</div>';
    }
    function railHtml(S, qs, B) {
        var n = total(S, qs), i = ORDER.indexOf(st.at), fin = st.at === 'final';
        var item = function (b, k) {
            var now = b.id === st.at, done = !now && Boolean(st.seen[b.id]);
            return '<li class="qk-c' + (now ? ' is-now' : '') + (done ? ' is-done' : '') + '" data-b="' + b.id + '"><button type="button" class="qk-cb" data-go="' + b.id + '"' + (now ? ' aria-current="step"' : '') + '>'
                + '<span class="v9-cm"><span>' + (k + 1) + '</span>' + CHECK + '</span><span class="qk-cn"><b>' + esc(b.n) + '</b><small>' + esc(summary(qs, b.id)) + '</small></span></button></li>';
        };
        var nchg = n ? loc('sq.nChg', '{n} 項改動', { n: n }) : loc('sq.noChg', '沒有改動');
        return '<aside class="dcard v9-rail qk-rail" data-block="quick-rail" data-rail aria-label="' + esc(loc('sq.railH', '快速設定')) + '" data-open="false">'
            + '<button type="button" class="v9-rtog" data-rtog aria-expanded="false"><b>' + esc(fin ? loc('sq.toFinal', '檢查並寫入') : B[i].n) + '</b><span>'
            + esc(fin ? nchg : loc('sq.pos', '第 {i} 組，共 {n} 組', { i: i + 1, n: B.length })) + '</span>' + CHEVRON + '</button>'
            + '<div class="v9-rh"><b>' + loc('sq.railH', '快速設定') + '</b><span>' + loc('sq.railS', '5 組 · 約 1 分鐘') + '</span></div>'
            + '<nav class="qk-ix" data-block="quick-index" aria-label="' + esc(loc('sq.railIx', '快速設定的組')) + '"><ol>' + B.map(item).join('')
            + '<li class="qk-c qk-cf' + (fin ? ' is-now' : '') + '" data-b="final"><button type="button" class="qk-cb" data-go="final"' + (fin ? ' aria-current="step"' : '') + '><span class="qk-wi">' + SAVE + '</span>'
            + '<span class="qk-cn"><b>' + loc('sq.toFinal', '檢查並寫入') + '</b><small>' + esc(nchg) + '</small></span></button></li></ol></nav>'
            + '<div class="qk-detail" data-block="quick-detail-link"><a class="qk-dl" href="#/settings/detail"><span><b>' + loc('sq.detail', '進入詳細設定') + '</b><small>'
            + loc('sq.detailS', '每個設定一個畫面，逐項調整') + '</small></span>' + ARROW + '</a></div></aside>';
    }
    function stripHtml(qs) {
        var c = nChanged(qs), nr = 0, na = 0, off = st.at === 'final' && !c;
        qs.forEach(function (q) { if (applies(q)) { if (rec(q).src === 'rec') nr++; else na++; } });
        var tail = c ? loc('sq.stripBack', '按右邊的按鈕全部改回推薦') : st.at === 'final' ? loc('sq.stripFinal', '下面是照推薦會改的') : loc('sq.stripHover', '滑過標籤看根據');
        return '<div class="qk-recs" data-block="quick-recs"><p class="qk-rt"><b>' + esc(c ? loc('sq.stripMine', '你改了 {n} 題推薦', { n: c }) : loc('sq.stripAll', '每題都先選好推薦了')) + '</b>'
            + '<span>' + esc(loc('sq.stripSub', '{r} 題依你的紀錄，{a} 題作者推薦；{tail}', { r: nr, a: na, tail: tail })) + '</span></p>'
            + '<button type="button" class="v9-btn pri qk-all" data-all' + (off ? ' disabled aria-pressed="true"' : '') + '>' + (off ? loc('sq.allDone', '已套用推薦') : loc('sq.all', '全部套用推薦')) + '</button></div>';
    }
    function footHtml(S, qs, B) {
        var i = ORDER.indexOf(st.at), n = total(S, qs), fin = st.at === 'final';
        var write = st.busy ? loc('sq.writing', '寫入中⋯') : st.wrote && !n ? loc('sq.wroteAll', '已寫入') : n ? loc('sq.writeN', '寫入 {n} 項', { n: n }) : loc('sq.nothing', '沒有要寫的');
        var next = st.at === 'away' ? loc('sq.toFinal', '檢查並寫入') : loc('sq.next', '下一組：{n}', { n: B[i + 1] ? B[i + 1].n : '' });
        return '<div class="v9-foot" data-block="quick-foot">' + (i > 0 ? '<button type="button" class="v9-btn" data-prev>' + loc('sq.prev', '上一組') + '</button>' : '')
            + '<span class="v9-pos" aria-live="polite">' + esc(fin ? loc('sq.posFinal', '寫入前檢查') : loc('sq.pos', '第 {i} 組，共 {n} 組', { i: i + 1, n: B.length })) + '</span>'
            + (fin ? '<button type="button" class="v9-btn pri" data-write' + (!n || st.busy || !(S && S.serve) ? ' disabled' : '') + '>' + esc(write) + '</button>'
                : '<button type="button" class="v9-btn pri" data-next>' + esc(next) + '</button>') + '</div>';
    }

    function page(S, o) {
        o = o || {};
        var hash = String(o.hash || (w && w.location && w.location.hash) || '');
        if (/^#\/?settings\/detail(\/|$)/.test(hash)) {
            return w && w.FK_SETDETAIL ? w.FK_SETDETAIL.page(S, o) : '<p class="an-empty">' + loc('sq.noDetail', '詳細設定還沒有載入。') + '</p>';
        }
        last = o;
        lastS = S;
        bind();
        var dirs = Object.keys((S && S.profiles && S.profiles.projects) || {});
        if (!dirs.length) return '<div class="st v9 qk" data-block="quick-page" data-sq><p class="an-empty">' + loc('sq.noProject', '還沒有專案可以設定：先在一個專案裡起一個 fankeel 任務。') + '</p></div>';
        if (dirs.indexOf(st.dir) < 0) st = fresh(dirs[0]);
        ask(S);
        var qs = questions(), B = blocks(), b = null;
        for (var i = 0; i < B.length; i++) if (B[i].id === st.at) b = B[i];
        var pick = dirs.length > 1 ? '<label class="qk-proj">' + loc('sq.proj', '專案') + ' <select data-sq-proj' + (st.busy ? ' disabled' : '') + '>' + dirs.map(function (d) {
            return '<option value="' + esc(d) + '"' + (d === st.dir ? ' selected' : '') + '>' + esc(d) + '</option>';
        }).join('') + '</select></label>' : '';
        return '<div class="st v9 qk" data-block="quick-page" data-sq>' + railHtml(S, qs, B)
            + '<section class="dcard v9-wiz qk-wiz" data-block="quick-wizard" aria-label="' + esc(loc('sq.railH', '快速設定')) + '">' + pick + stripHtml(qs)
            + (b ? screenHtml(S, o, qs, b) : finalHtml(S, o, qs)) + footHtml(S, qs, B) + '</section></div>';
    }

    // ---- events: bound on document once, acting only inside [data-sq] ----
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function later(fn) { if (w && typeof w.setTimeout === 'function') w.setTimeout(fn, 0); }
    function focusId(id) { later(function () { var el = doc && doc.getElementById(id); if (el && typeof el.focus === 'function') el.focus({ preventScroll: true }); }); }
    function go(to) {
        if (ORDER.indexOf(to) < 0) return;
        if (st.at !== 'final') st.seen[st.at] = true;
        st.at = to;
        redraw();
        focusId('qkb-' + to);
        if (w && typeof w.scrollTo === 'function') w.scrollTo(0, 0);
    }
    function closeTips(keep) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return;
        [].forEach.call(doc.querySelectorAll('[data-sq] [data-qm][aria-expanded="true"]'), function (x) { if (x !== keep) x.setAttribute('aria-expanded', 'false'); });
    }
    function inside(t) { return t && typeof t.closest === 'function' && t.closest('[data-sq]') ? t : null; }
    function write() {
        var S = lastS, qs = questions();
        if (!S || !S.serve || st.busy) return;
        var ch = changes(S, qs), m = machine(S), jobs = [], dir = st.dir, n = 0;
        if (ch.length) jobs.push({ scope: 'project', project: dir, rows: ch });
        if (m.rows.length) jobs.push({ scope: 'machine', rows: m.rows });
        if (!jobs.length) return;
        st.busy = true;
        st.err = '';
        redraw();
        var next = function (i) {
            if (st.dir !== dir) return;
            if (i >= jobs.length) { st.busy = false; st.wrote = n; redraw(); return; }
            post(S, jobs[i], jobs[i].rows, function (ok) {
                if (!ok) {
                    st.busy = false;
                    st.wrote = n;
                    st.err = jobs[i].scope === 'machine' ? loc('sq.failM', '寫入這台機器的設定失敗，那邊沒有存。') : loc('sq.failP', '寫入專案的設定失敗，那邊沒有存。');
                    redraw();
                    return;
                }
                n += jobs[i].rows.length;
                next(i + 1);
            });
        };
        next(0);
    }
    function onClick(e) {
        var t = inside(e && e.target);
        if (!t) { closeTips(null); return; }
        var qm = t.closest('[data-qm]');
        if (qm) {
            var open = qm.getAttribute('aria-expanded') !== 'true';
            closeTips(qm);
            qm.setAttribute('aria-expanded', String(open));
            return;
        }
        closeTips(null);
        var b = t.closest('[data-o]'), q = b && b.closest('[data-q]');
        if (q) {
            var id = q.getAttribute('data-q'), qq = null;
            questions().forEach(function (x) { if (x.id === id) qq = x; });
            var a = qq && optOf(qq, b.getAttribute('data-o'));
            if (!a) return;
            st.ans[id] = a.o;
            st.wrote = 0;
            st.err = '';
            redraw();
            if (a.input) focusId('qki-' + id);
            return;
        }
        var g = t.closest('[data-go]');
        if (g) { go(g.getAttribute('data-go')); return; }
        if (t.closest('[data-all]')) {
            questions().forEach(function (x) { st.ans[x.id] = rec(x).o; });
            blocks().forEach(function (x) { st.seen[x.id] = true; });
            st.wrote = 0;
            go('final');
            return;
        }
        if (t.closest('[data-next]')) { go(ORDER[ORDER.indexOf(st.at) + 1]); return; }
        if (t.closest('[data-prev]')) { go(ORDER[ORDER.indexOf(st.at) - 1]); return; }
        var mc = t.closest('[data-mc]');
        if (mc) { st.mc = mc.getAttribute('data-mc') === 'yes' ? 'yes' : 'no'; st.wrote = 0; redraw(); return; }
        if (t.closest('[data-write]')) { write(); return; }
        var tg = t.closest('[data-rtog]'), rail = tg && tg.closest('[data-rail]');
        if (rail) {
            var op = rail.getAttribute('data-open') !== 'true';
            rail.setAttribute('data-open', String(op));
            tg.setAttribute('aria-expanded', String(op));
        }
    }
    function slid(t) {
        var q = t && t.getAttribute('data-slide') !== null ? t.closest('[data-q]') : null, qq = null;
        if (!q) return null;
        questions().forEach(function (x) { if (x.id === q.getAttribute('data-q')) qq = x; });
        var a = qq && slideSync(t, qq.opts);
        if (!a) return null;
        st.ans[qq.id] = a.o;
        st.wrote = 0;
        st.err = '';
        return qq.id;
    }
    // Typing changes the state only: a redraw would take the caret out of the box.
    function onInput(e) {
        var t = inside(e && e.target);
        if (slid(t)) return;
        var q = t && t.getAttribute('data-in') !== null ? t.closest('[data-q]') : null;
        if (!q) return;
        var id = q.getAttribute('data-q'), f = t.closest('[data-field]');
        st.inp[id] = String(t.value || '');
        if (f) st.ans[id] = f.getAttribute('data-field');
        st.wrote = 0;
    }
    function onChange(e) {
        var t = inside(e && e.target);
        if (!t) return;
        var sl = slid(t);
        if (sl) { redraw(); focusId('qkr-' + sl); return; }
        var k = t.getAttribute('data-mk');
        if (k) { st.mk[k] = Boolean(t.checked); if (st.mc === 'yes') st.mc = ''; redraw(); return; }
        if (t.getAttribute('data-cf') !== null) { st.cf = Boolean(t.checked); st.wrote = 0; redraw(); return; }
        if (t.getAttribute('data-sq-proj') !== null) { st = fresh(String(t.value)); redraw(); }
    }
    function onKey(e) {
        if (e && e.key === 'Escape') { closeTips(null); return; }
        var t = inside(e && e.target), q = t && t.getAttribute('data-o') !== null ? t.closest('[data-q]') : null;
        var step = e && (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : e && (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
        if (!q || !step) return;
        var id = q.getAttribute('data-q'), qq = null;
        questions().forEach(function (x) { if (x.id === id) qq = x; });
        if (!qq) return;
        var os = qq.opts.map(function (a) { return a.o; }), i = os.indexOf(t.getAttribute('data-o')) + step;
        st.ans[id] = os[(i + os.length) % os.length];
        st.wrote = 0;
        if (typeof e.preventDefault === 'function') e.preventDefault();
        redraw();
        later(function () {
            var el = doc && typeof doc.querySelector === 'function' ? doc.querySelector('[data-q="' + id + '"] [data-o="' + st.ans[id] + '"]') : null;
            if (el && typeof el.focus === 'function') el.focus();
        });
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput);
        doc.addEventListener('change', onChange);
        doc.addEventListener('keydown', onKey);
    }
    function state() { return st; }
    function reset() { st = fresh(null); over = {}; last = null; lastS = null; }

    var api = { page: page, questions: questions, blocks: blocks, NAME: NAME, MACHINE: MACHINE, AUTHOR: AUTHOR, cur: cur, lab: lab, optHtml: optHtml, sliderHtml: sliderHtml, slideSync: slideSync, post: post,
        onClick: onClick, onInput: onInput, onChange: onChange, onKey: onKey, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SETTINGS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
