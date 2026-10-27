'use strict';
// assets/station/mobile.js — the phone station, /m
// (docs/99-archive/2026-10-22-mobile-session-design.md; the approved
// mockup's direction A: m-home-a, m-chat-a, m-composer-a, m-tools, m-attach,
// m-background, m-idle, m-gate-inline, and pair-scan / pair-error from the
// remote design; the tab bar, #/ask, #/s/<id>/<pane> and the 測站 sheet from
// .fankeel/build/2026-10-27-mobile-app/mockup.html). The session list reads /station/mobile.json (lib/mobile.js)
// every five seconds; a session's conversation reads
// /station/phone.json?id=<id> every two, and redraws only what changed, so a
// reload never wipes what is being picked, typed or said. Messages go through
// POST /phone/say, which a holding Stop hook hands to the session; a held gate
// is answered through POST /answer. Pairs through POST /station/remote/pair,
// whose 201 sets the device cookie the browser sends itself. Carries its own
// strings — station.js's loc() table is not on this page. The drawing
// functions are pure and exported for the tests; `boot` runs only on a page
// with #app.
(function (w) {
    var STR = {
        zh: {
            'home.title': 'Session', 'home.hist': '完成的任務', 'home.empty': '沒有在跑的 session',
            'sum.ask': '<b>{n}</b> 個等你', 'sum.run': '<b>{n}</b> 個在跑', 'sum.idle': '<b>{n}</b> 個閒置',
            'grp.ask': '等你答', 'grp.run': '在跑', 'grp.idle': '停下來', 'grp.gone': '停了但還在等你答',
            'st.ask': '等你答', 'st.held': '手機接著', 'st.run': '跑中', 'st.bg': '背景跑中 · {n}', 'st.idle': '閒置',
            'home.go': '去答', 'home.left': '剩 {t}', 'home.more': '+{n} 個', 'home.you': '你：', 'home.stopped': '停下來了，沒有在跑的工作',
            'chat.back': '回 Session 清單', 'chat.log': '對話', 'chat.gone': '這個 session 不在了',
            'who.pc': '電腦', 'who.ph': '手機', 'who.ai': 'Claude',
            'chat.sent': '已送進 session', 'chat.queued': '等這回合跑完就送進去', 'chat.work': 'Claude 正在做…',
            'give': '交還電腦', 'ro': '只能看',
            'att.go': '接上這個 session', 'att.run': '下一回合結束時改由手機接手，電腦會顯示它在手機上。', 'att.bg': '背景跑完、Claude 接著做完那一回合時，改由手機接手。',
            'bg.label': '背景工作', 'bg.still': '還在跑', 'bg.head': '背景工作 {n} 個', 'bg.start': '{kind} · {t} 開始', 'bg.run': '跑中',
            'bg.foot': '背景工作完成後 Claude 會自己接著做，不用回覆',
            'idle.title': '閒置的 session 手機推不動', 'idle.why': '停下來了，沒有在跑的工作。它停在電腦的輸入框等你打字，手機送的訊息沒有地方接。',
            'idle.give.t': '交給手機', 'idle.give': '在電腦打 <code>/fankeel-phone</code>，這回合一結束就換手機接。',
            'idle.wait.t': '或等它', 'idle.wait': '電腦那邊再送出任何一句，那回合結束時手機就能接上。',
            'steps.n': '{n} 個步驟', 'steps.files': '改了 {n} 個檔', 'steps.agents': '{n} 個 agent', 'steps.failed': '{n} 個失敗',
            'steps.ran': '跑了 {t}', 'steps.folded': '前 {n} 個收起', 'steps.now': '正在：{label}', 'steps.fail': '失敗',
            'dur.tenths': '{n} 秒', 'dur.sec': '{n} 秒', 'dur.min': '{m} 分 {s} 秒',
            'cmp.label': '給 Claude 的下一句', 'cmp.ph': '給 Claude 的下一句…', 'cmp.send': '送出',
            'cmp.held': '手機接著：送出就是下一句', 'cmp.next': '這回合跑完就送進去', 'cmp.waiting': '上一句還在等這回合跑完', 'cmp.voice': '按麥克風用講的', 'pic.label': '附圖片',
            'mic.label': '用講的輸入', 'mic.answer': '用講的寫答案', 'mic.hint': '想用講的：按麥克風，會自動選這一項',
            'mic.on': '聆聽中… 再按一次停止', 'mic.done': '聽好了：可以改字，按送出才會送',
            'mic.denied': '沒有麥克風權限：到瀏覽器設定允許，或改按鍵盤上的語音鍵', 'mic.missed': '沒聽清楚：再按一次麥克風',
            'gc.head': '{stage} gate', 'gc.left': '剩 {t} · 之後轉回電腦',
            'hx.agent': 'agent 回報', 'hx.note': '任務通知', 'hx.sys': '系統提醒',
            'gpin.go': '看選項', 'rep.more': '展開完整報告', 'rep.less': '收起報告',
            'gate.pick': '選一個答案', 'gate.pickMany': '可以選幾個', 'gate.own': '自己寫答案…', 'gate.rec': '建議', 'gate.send': '送出答案',
            'gate.sending': '送出中…', 'gate.sent': '送出了，等 Claude 接著做', 'gate.needAll': '每一題都要有答案',
            'ph.list': '要附上的照片', 'ph.alt': '第 {n} 張照片', 'ph.x': '拿掉第 {n} 張', 'ph.add': '加照片，還能加 {n} 張', 'ph.over': '最多 {n} 張：多選的沒有加進來',
            'ph.lim': '最多 {n} 張 · 自動縮到 {px}px', 'ph.limWhy': '每張在手機上先縮成長邊 {px}px 的 JPEG（品質 {q}），通常 300–600 KB。這是 Claude 讀圖的大小，再大只多花上傳時間和 token。單張上傳上限 10 MB。',
            'ph.pick': '加照片，一次可選多張', 'ph.up': '上傳中 {n}%', 'ph.wait': '第 {n} 張還在上傳，傳完才能送出',
            'gate.failed': '沒送到：可以再按一次', 'gate.gone': '這個 gate 已經不在等了', 'gate.refused': '測站沒收下（{code}）：{why}',
            'done.title': '完成', 'done.empty': '48 小時內沒有完成的', 'done.end': '任務結束', 'done.stage': '完成 ·', 'done.today': '今天', 'done.yesterday': '昨天', 'done.upTo': '到 {t}',
            'ago.now': '剛剛', 'ago.min': '{n} 分', 'ago.hour': '{n} 小時', 'ago.day': '{n} 天',
            'host.on': '已連上 {host}', 'host.station': '測站',
            'pair.title': '掃桌機測站上的 QR', 'pair.where': '在 <b>設定</b> › <b>手機遠端</b>', 'pair.frame': '相機取景框', 'pair.type': '輸入配對碼',
            'pair.code': '8 位配對碼', 'pair.go': '配對', 'pair.busy': '配對中…', 'pair.failed': '連不到測站：再試一次', 'pair.bad': '配對碼是 8 個英文字母或數字', 'pair.refused': '配對沒成功（{code}）：{why}',
            'off.title': '連不到 {host}', 'off.hint': '打開手機的 Tailscale 再試。', 'off.badge': 'Tailscale 未連線', 'off.retry': '重試', 'off.repair': '重新配對',
            'tab.nav': '分頁', 'tab.ask': '等你', 'tab.n': '{n} 個等你', 'ask.empty': '沒有在等你答的', 'ask.opts': '{n} 個選項',
            'host.open': '已連上 {host}，看測站與配對', 'done.dn': '完成', 'span.hm': '{h} 小時 {m} 分',
            'sc.more': '展開最新一句與背景工作', 'sc.less': '收起最新一句與背景工作', 'sc.held': '手機接著 · 剩 {t}', 'sc.attached': '這回合結束時換手機接', 'sc.bg': '{n} 個背景工作在跑',
            'rs.me': '這支手機', 'rs.local': '這台電腦', 'rs.paired': '{d} 配對', 'rs.unpair': '要解除配對，到電腦的 <b>設定</b> › <b>手機遠端</b> 按「解除」。', 'rs.localWhy': '從這台電腦打開，不用配對。',
            'rs.hold': '每回合結束等你下一句；時間到就交還電腦。', 'rs.pairV': '換一台測站或重設', 'rs.pairWhy': '掃電腦上新的 QR，或輸入新的配對碼。',
            'pn.nav': 'session 檢視，左右滑動也能換', 'pn.talk': '對話', 'pn.timeline': '概覽', 'pn.plan': '計畫', 'pn.dispatch': '派工', 'pn.events': '事件', 'pn.gate': '關卡', 'pn.bg': '{n} 個在背景跑',
            'tk.ctx': 'context', 'tk.five': '5 小時', 'tk.seven': '7 天', 'tk.aria': '用量：context {c}，5 小時 {f}，7 天 {s}；點開看重置時間',
            'tk.at': ' · 壓縮線 {n}', 'tk.ofAt': '（到壓縮線）', 'tk.resets': '{t} 重置 · 時間已過 {n}%', 'tk.none': '還沒有讀數',
            'ov.empty': '這個 session 48 小時內沒有完成的站', 'ov.sum': '{n} 站 · {from} 到 {to}', 'ov.doneAt': '{t} 完成', 'ov.at': '完成於', 'ov.took': '這一站', 'ov.tookV': '{t}（從上一站完成算起）',
            'ov.cost': '花費', 'ov.share': ' · 全部的 {n}%', 'ov.full': '在完整頁面打開',
            'pl.empty': '這個 session 沒有路線', 'pl.done': '完成', 'pl.now': '進行中', 'pl.todo': '還沒到', 'pl.notyet': '還沒完成',
            'dp.empty': '沒有在背景跑的 agent 或 shell', 'dp.kind': '種類', 'dp.cmd': '指令', 'dp.start': '開始',
            'ev.empty': '還沒有步驟', 'ev.tool': '工具', 'ev.start': '開始', 'ev.took': '花了', 'gt.empty': '沒有在等你答的關卡',
        },
        en: {
            'home.title': 'Session', 'home.hist': 'Finished tasks', 'home.empty': 'No session is running',
            'sum.ask': '<b>{n}</b> need you', 'sum.run': '<b>{n}</b> running', 'sum.idle': '<b>{n}</b> idle',
            'grp.ask': 'Needs you', 'grp.run': 'Running', 'grp.idle': 'Stopped', 'grp.gone': 'Stopped, still asking',
            'st.ask': 'Needs you', 'st.held': 'On phone', 'st.run': 'Running', 'st.bg': 'Background · {n}', 'st.idle': 'Idle',
            'home.go': 'Answer', 'home.left': '{t} left', 'home.more': '+{n} more', 'home.you': 'You: ', 'home.stopped': 'Stopped, nothing running',
            'chat.back': 'Back to sessions', 'chat.log': 'Conversation', 'chat.gone': 'This session is gone',
            'who.pc': 'Desktop', 'who.ph': 'Phone', 'who.ai': 'Claude',
            'chat.sent': 'Sent to the session', 'chat.queued': 'Goes in when this turn ends', 'chat.work': 'Claude is working…',
            'give': 'Back to desktop', 'ro': 'Read only',
            'att.go': 'Take over this session', 'att.run': 'The phone takes over when this turn ends; the desktop shows it is on the phone.', 'att.bg': 'The phone takes over once the background work ends and Claude finishes that turn.',
            'bg.label': 'Background work', 'bg.still': 'Still running', 'bg.head': '{n} background jobs', 'bg.start': '{kind} · started {t}', 'bg.run': 'running',
            'bg.foot': 'When the background work ends Claude carries on by itself; no reply needed',
            'idle.title': 'The phone cannot push an idle session', 'idle.why': 'Stopped, nothing running. It waits at the desktop prompt, and a message from the phone has nowhere to go.',
            'idle.give.t': 'Hand it over', 'idle.give': 'Type <code>/fankeel-phone</code> on the desktop; the phone takes over when that turn ends.',
            'idle.wait.t': 'Or wait', 'idle.wait': 'Send anything from the desktop, and the phone can take over when that turn ends.',
            'steps.n': '{n} steps', 'steps.files': '{n} files changed', 'steps.agents': '{n} agents', 'steps.failed': '{n} failed',
            'steps.ran': 'ran {t}', 'steps.folded': 'first {n} folded', 'steps.now': 'Now: {label}', 'steps.fail': 'failed',
            'dur.tenths': '{n} s', 'dur.sec': '{n} s', 'dur.min': '{m} min {s} s',
            'cmp.label': 'Next message to Claude', 'cmp.ph': 'Next message to Claude…', 'cmp.send': 'Send',
            'cmp.held': 'On the phone: what you send is the next message', 'cmp.next': 'Goes in when this turn ends', 'cmp.waiting': 'The last message is still waiting for this turn to end', 'cmp.voice': 'tap the mic to speak', 'pic.label': 'Attach a photo',
            'mic.label': 'Speak instead of typing', 'mic.answer': 'Speak your answer', 'mic.hint': 'Tap the mic to speak; it picks this option',
            'mic.on': 'Listening… tap again to stop', 'mic.done': 'Heard: edit it if you like; only Send sends',
            'mic.denied': 'No microphone permission: allow it in the browser settings, or use the keyboard\'s voice key', 'mic.missed': 'Did not catch that: tap the mic again',
            'gc.head': '{stage} gate', 'gc.left': '{t} left · then back to the desktop',
            'hx.agent': 'Agent report', 'hx.note': 'Task notice', 'hx.sys': 'System reminder',
            'gpin.go': 'See options', 'rep.more': 'Show the full report', 'rep.less': 'Collapse the report',
            'gate.pick': 'Pick one answer', 'gate.pickMany': 'Pick any number', 'gate.own': 'Write your own answer…', 'gate.rec': 'Recommended', 'gate.send': 'Send answer',
            'gate.sending': 'Sending…', 'gate.sent': 'Sent; Claude carries on', 'gate.needAll': 'Every question needs an answer',
            'ph.list': 'Photos to attach', 'ph.alt': 'Photo {n}', 'ph.x': 'Remove photo {n}', 'ph.add': 'Add photos, {n} more allowed', 'ph.over': 'Up to {n} photos: the extra ones were not added',
            'ph.lim': 'Up to {n} · shrunk to {px}px', 'ph.limWhy': 'Each photo is shrunk on the phone to a {px}px long edge as JPEG (quality {q}), usually 300-600 KB. That is the size Claude reads images at; larger only costs upload time and tokens. One upload is capped at 10 MB.',
            'ph.pick': 'Add photos, several at once', 'ph.up': 'Uploading {n}%', 'ph.wait': 'Photo {n} is still uploading; send once it is done',
            'gate.failed': 'Not sent: press again', 'gate.gone': 'This gate is no longer waiting', 'gate.refused': 'The station refused it ({code}): {why}',
            'done.title': 'Done', 'done.empty': 'Nothing finished in the last 48 hours', 'done.end': 'Task ended', 'done.stage': 'done ·', 'done.today': 'Today', 'done.yesterday': 'Yesterday', 'done.upTo': 'up to {t}',
            'ago.now': 'now', 'ago.min': '{n} min', 'ago.hour': '{n} h', 'ago.day': '{n} d',
            'host.on': 'Connected to {host}', 'host.station': 'the station',
            'pair.title': 'Scan the QR on the desktop station', 'pair.where': 'Under <b>Settings</b> › <b>Phone remote</b>', 'pair.frame': 'Camera viewfinder', 'pair.type': 'Type the pairing code',
            'pair.code': '8-character code', 'pair.go': 'Pair', 'pair.busy': 'Pairing…', 'pair.failed': 'Could not reach the station: try again', 'pair.bad': 'A pairing code is 8 letters or digits', 'pair.refused': 'Pairing refused ({code}): {why}',
            'off.title': 'Cannot reach {host}', 'off.hint': 'Turn on Tailscale on this phone and try again.', 'off.badge': 'Tailscale not connected', 'off.retry': 'Retry', 'off.repair': 'Pair again',
            'tab.nav': 'Tabs', 'tab.ask': 'Needs you', 'tab.n': '{n} need you', 'ask.empty': 'Nothing is waiting for you', 'ask.opts': '{n} options',
            'host.open': 'Connected to {host}; see the station and pairing', 'done.dn': 'done', 'span.hm': '{h} h {m} min',
            'sc.more': 'Show the latest line and background work', 'sc.less': 'Hide the latest line and background work', 'sc.held': 'On the phone · {t} left', 'sc.attached': 'The phone takes over when this turn ends', 'sc.bg': '{n} background jobs running',
            'rs.me': 'This phone', 'rs.local': 'This computer', 'rs.paired': 'paired {d}', 'rs.unpair': 'To unpair, press Remove under <b>Settings</b> › <b>Phone remote</b> on the desktop.', 'rs.localWhy': 'Opened on this computer; no pairing needed.',
            'rs.hold': 'Each turn waits for your next message; when time runs out it goes back to the desktop.', 'rs.pairV': 'Another station, or start over', 'rs.pairWhy': 'Scan the new QR on the desktop, or type a new code.',
            'pn.nav': 'Session views; swipe to switch', 'pn.talk': 'Talk', 'pn.timeline': 'Overview', 'pn.plan': 'Plan', 'pn.dispatch': 'Dispatch', 'pn.events': 'Events', 'pn.gate': 'Gate', 'pn.bg': '{n} running in the background',
            'tk.ctx': 'context', 'tk.five': '5 hours', 'tk.seven': '7 days', 'tk.aria': 'Usage: context {c}, 5 hours {f}, 7 days {s}; tap for reset times',
            'tk.at': ' · compacts at {n}', 'tk.ofAt': ' (to the compact line)', 'tk.resets': 'resets {t} · {n}% of the window gone', 'tk.none': 'No reading yet',
            'ov.empty': 'No stage of this session finished in the last 48 hours', 'ov.sum': '{n} stages · {from} to {to}', 'ov.doneAt': 'done {t}', 'ov.at': 'Done at', 'ov.took': 'This stage', 'ov.tookV': '{t} (since the stage before ended)',
            'ov.cost': 'Cost', 'ov.share': ' · {n}% of the total', 'ov.full': 'Open the full page',
            'pl.empty': 'This session has no route', 'pl.done': 'done', 'pl.now': 'in progress', 'pl.todo': 'not yet', 'pl.notyet': 'not finished',
            'dp.empty': 'No agent or shell is running in the background', 'dp.kind': 'Kind', 'dp.cmd': 'Command', 'dp.start': 'Started',
            'ev.empty': 'No steps yet', 'ev.tool': 'Tool', 'ev.start': 'Started', 'ev.took': 'Took', 'gt.empty': 'No gate is waiting for you',
        },
    };
    var lang = 'zh';
    var POLL_MS = 5000;
    var CHAT_MS = 2000;
    // A message's photos (round 3): four at most, each shrunk on the phone to the long edge Claude
    // reads images at, as JPEG at this quality — larger only costs upload time and tokens.
    var PH_MAX = 4;
    var PH_EDGE = 1568;
    var PH_Q = 0.85;
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var FIVE_MS = 5 * 3600e3;
    var SEVEN_MS = 7 * 864e5;
    // A session's panes in tab order: route key, icon, the pn.<key> label (the desktop focus page's tabs).
    var PANES = [['talk', 'msg'], ['timeline', 'chart'], ['plan', 'checks'], ['dispatch', 'bot'], ['events', 'zap'], ['gate', 'gate']];
    // Each state's screen root, as the mockup names its block.
    var SCREEN = {
        gate: 'data-block="m-gate-inline"', idle: 'data-block="m-idle"', background: 'data-block="m-background"',
        holding: 'data-block="m-chat-a"', attached: 'data-block="m-chat-a"', running: 'data-block="m-attach"',
    };
    var ORDER = { holding: 0, running: 1, background: 2 };
    // An assistant line past this is cut: a phone screen, not the transcript.
    var MSG_CAP = 2000;
    // A label ending in (Recommended) or (建議) is picked before anything is touched.
    var REC = /\s*\((?:Recommended|建議)\)\s*$/;
    var TOOL_IC = { Bash: 'term', Edit: 'pencil', Write: 'pencil', NotebookEdit: 'pencil', Agent: 'bot', Task: 'bot', Read: 'eye' };
    // The mockup's icons: Lucide (ISC) on 24, the station's own set on 16.
    var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
        + '<symbol id="i-gate" viewBox="0 0 16 16"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></symbol>'
        + '<symbol id="i-check" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></symbol>'
        + '<symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>'
        + '<symbol id="i-back" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>'
        + '<symbol id="i-cc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></symbol>'
        + '<symbol id="i-kbd" viewBox="0 0 24 24"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></symbol>'
        + '<symbol id="i-pencil" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></symbol>'
        + '<symbol id="i-laptop" viewBox="0 0 24 24"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></symbol>'
        + '<symbol id="i-phone" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></symbol>'
        + '<symbol id="i-up" viewBox="0 0 24 24"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></symbol>'
        + '<symbol id="i-mic" viewBox="0 0 24 24"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></symbol>'
        + '<symbol id="i-image" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></symbol>'
        + '<symbol id="i-hist" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></symbol>'
        + '<symbol id="i-term" viewBox="0 0 24 24"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></symbol>'
        + '<symbol id="i-bot" viewBox="0 0 24 24"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></symbol>'
        + '<symbol id="i-pause" viewBox="0 0 24 24"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></symbol>'
        + '<symbol id="i-spin" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></symbol>'
        + '<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></symbol>'
        + '<symbol id="i-wifioff" viewBox="0 0 24 24"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></symbol>'
        + '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></symbol>'
        + '<symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></symbol>'
        + '<symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></symbol>'
        + '<symbol id="i-msg" viewBox="0 0 24 24"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></symbol>'
        + '<symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>'
        + '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>'
        + '<symbol id="i-server" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></symbol>'
        + '<symbol id="i-link" viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></symbol>'
        + '<symbol id="i-layers" viewBox="0 0 24 24"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></symbol>'
        + '<symbol id="i-activity" viewBox="0 0 24 24"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></symbol>'
        + '<symbol id="i-checks" viewBox="0 0 24 24"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></symbol>'
        + '<symbol id="i-coins" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></symbol>'
        + '<symbol id="i-timer" viewBox="0 0 24 24"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></symbol>'
        + '<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></symbol>'
        + '<symbol id="i-qr" viewBox="0 0 24 24"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></symbol>'
        + '<symbol id="i-brain" viewBox="0 0 24 24"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4"/><path d="M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294"/><path d="M17.996 5.125a4 4 0 012.526 5.77"/><path d="M18 18a4 4 0 002-7.465"/><path d="M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517"/><path d="M6 18a4 4 0 01-2-7.465"/><path d="M6.004 5.125a4 4 0 00-2.526 5.77"/></symbol>'
        + '<symbol id="i-calclock" viewBox="0 0 24 24"><path d="M16 14v2.2l1.6 1"/><path d="M16 2v3"/><path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338"/><path d="M3 9h5.859"/><path d="M8 2v3"/><circle cx="16" cy="16" r="6"/></symbol>'
        + '<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></symbol>'
        + '<symbol id="i-zap" viewBox="0 0 24 24"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/></symbol>'
        + '<symbol id="i-hourglass" viewBox="0 0 24 24"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></symbol>'
        + '<symbol id="i-images" viewBox="0 0 24 24"><path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/><path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/><circle cx="13" cy="7" r="1" fill="currentColor"/><rect x="8" y="2" width="14" height="14" rx="2"/></symbol>'
        + '<symbol id="i-ask" viewBox="0 0 24 24"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></symbol>'
        + '<symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></symbol>'
        + '<symbol id="i-imgplus" viewBox="0 0 24 24"><path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/></symbol>'
        + '<symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></symbol>'
        + '<symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></symbol>'
        + '</svg>';
    // The masthead's glyph, as pair-scan's lock-up draws it.
    var GLYPH = '<svg class="glyph" viewBox="0 0 120 120" aria-hidden="true">'
        + '<path class="gseg done" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/><path class="gseg done" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/>'
        + '<path class="gseg done" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/><path class="gseg done" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/>'
        + '<path class="gseg done" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/><path class="gseg done" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/>'
        + '<path class="gedge done" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/>'
        + '<path class="gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg>';

    function setLang(l) { lang = l === 'en' ? 'en' : 'zh'; return lang; }
    // A string of this page's own; `vars` are put in as given, so a caller
    // escapes any it took from the registry.
    function t(key, vars) {
        var s = STR[lang][key];
        if (s === undefined) s = STR.zh[key];
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; });
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function stVar(stage) { return STAGES.indexOf(stage) >= 0 ? 'var(--st-' + stage + ')' : 'var(--st-none)'; }
    function stw(stage) { return '<span class="hm-stw" style="--c:' + stVar(stage) + '">' + esc(stage) + '</span>'; }
    function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
    function ago(ms) {
        var m = Math.max(0, Math.floor(ms / 60e3));
        if (m < 1) return t('ago.now');
        if (m < 60) return t('ago.min', { n: m });
        if (m < 1440) return t('ago.hour', { n: Math.floor(m / 60) });
        return t('ago.day', { n: Math.floor(m / 1440) });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function hm(at) { var d = new Date(at); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    // m:ss, for a countdown or a step still running.
    function clock(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); }
    function dayOf(at) { var d = new Date(at); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function usd(v) { return num(v) ? '$' + v.toFixed(2) : '—'; }
    function stwI(stage) { return '<span class="hm-stw stw-i" style="--c:' + stVar(stage) + '">' + ic('layers') + esc(stage) + '</span>'; }
    function md(at) { var d = new Date(at); return (d.getMonth() + 1) + '/' + d.getDate(); }
    // A stage's length: 15 分, 1 小時 30 分.
    function took(ms) {
        var m = Math.max(0, Math.round(ms / 60e3));
        return m < 60 ? t('ago.min', { n: m }) : t('span.hm', { h: Math.floor(m / 60), m: m % 60 });
    }
    function kTok(n) { return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1e3) + 'k'; }
    function pct(v) { return num(v) ? Math.max(0, Math.min(100, Math.round(v))) : null; }
    // How much of a window that resets at `resets` and lasts `span` has gone by, in percent.
    function paceOf(resets, span, at) { return num(resets) ? pct((1 - (resets - at) / span) * 100) : null; }

    // #/ the session list, #/ask the held gates, #/done the history, #/s/<id>[/<pane>] one
    // session on one of its six panes (#/gate/<id> and #/task/<id> land on 對話), #/pair/<code>
    // the desktop QR's pairing url.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { view: 'home', id: null, pair: m[1].toUpperCase() };
        m = /^\/(?:s|gate|task)\/([0-9A-Za-z-]+)(?:\/(talk|timeline|plan|dispatch|events|gate))?$/.exec(h);
        if (m) return { view: 'chat', id: m[1], pair: null, pane: m[2] || 'talk' };
        if (h === '/done') return { view: 'done', id: null, pair: null };
        if (h === '/ask') return { view: 'ask', id: null, pair: null };
        return { view: 'home', id: null, pair: null };
    }

    // The pane a sideways swipe lands on: one over, only for a long and mostly sideways one.
    function swipeTo(pane, dx, dy) {
        if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return null;
        var ids = PANES.map(function (x) { return x[0]; });
        var i = ids.indexOf(pane || 'talk') + (dx < 0 ? 1 : -1);
        return i >= 0 && i < ids.length ? ids[i] : null;
    }

    // A code off the pairing url a QR carries, or eight characters typed.
    function codeIn(text) {
        var s = String(text == null ? '' : text);
        var m = /#\/pair\/([A-Za-z0-9]{8})(?![A-Za-z0-9])/.exec(s) || /^\s*([A-Za-z0-9]{8})\s*$/.exec(s);
        return m ? m[1].toUpperCase() : null;
    }

    // pgAnswers' rule (assets/station/station.js): a single choice is the
    // typed text, else the label picked; a multi-select is the labels and the
    // text, joined ', '. Null while any question has no answer.
    function answersOf(questions, picks, others) {
        var qs = questions || [];
        var answers = {};
        var missing = 0;
        qs.forEach(function (q, i) {
            var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
            var text = String((others || {})[i] || '').trim();
            var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
            if (a) answers[q.question] = a;
            else missing++;
        });
        return missing || !qs.length ? null : answers;
    }

    // The gate card's inputs: every ticked value per question (`q<n>`), and a
    // 自己寫 box's text only where that question's __other is ticked.
    function collect(inputs, count) {
        var picks = {};
        var others = {};
        var ticked = {};
        var i;
        for (i = 0; i < count; i++) picks[i] = [];
        Array.prototype.forEach.call(inputs || [], function (el) {
            var q = /^q(\d+)$/.exec(el.name || '');
            if (!q || !el.checked) return;
            (picks[q[1]] = picks[q[1]] || []).push(el.value);
            if (el.value === '__other') ticked[q[1]] = true;
        });
        Array.prototype.forEach.call(inputs || [], function (el) {
            var own = el.getAttribute ? el.getAttribute('data-own') : null;
            if (own !== null && own !== undefined && ticked[own]) others[own] = el.value;
        });
        return { picks: picks, others: others };
    }

    // Consecutive tool / tool-end lines are one group; an empty assistant
    // line ends a turn and draws nothing.
    function turnsOf(chat) {
        var out = [];
        var group = null;
        (chat || []).forEach(function (x) {
            if (x.role === 'tool' || x.role === 'tool-end') {
                if (!group) { group = { kind: 'steps', items: [], ends: {} }; out.push(group); }
                if (x.role === 'tool') group.items.push(x); else group.ends[x.id] = x;
                return;
            }
            group = null;
            if (x.role === 'assistant' && !String(x.text || '').trim()) return;
            out.push({ kind: 'msg', role: x.role, text: String(x.text || ''), at: x.at });
        });
        out.forEach(function (g) {
            if (g.kind !== 'steps') return;
            g.items = g.items.map(function (s) { var e = g.ends[s.id]; return Object.assign({}, s, { end: e ? e.at : null, ok: e ? e.ok !== false : null }); });
        });
        return out;
    }

    // 「N 個步驟 · 改了 K 個檔 · A 個 agent · F 個失敗」— a part only when it is not zero;
    // a step with no tool-end by the turn's end counts as failed (spec, Not verified).
    function stepsLine(items) {
        var files = {};
        var agents = 0;
        var failed = 0;
        items.forEach(function (s) {
            if (/^(Edit|Write|NotebookEdit)$/.test(s.tool)) files[s.label] = true;
            if (s.tool === 'Agent' || s.tool === 'Task') agents++;
            if (s.ok !== true) failed++;
        });
        var k = Object.keys(files).length;
        return [t('steps.n', { n: items.length })]
            .concat(k ? [t('steps.files', { n: k })] : [], agents ? [t('steps.agents', { n: agents })] : [], failed ? [t('steps.failed', { n: failed })] : [])
            .join(' · ');
    }

    function dur(ms) {
        var s = Math.max(0, ms) / 1000;
        if (s < 10) return t('dur.tenths', { n: s.toFixed(1) });
        if (s < 60) return t('dur.sec', { n: Math.floor(s) });
        return t('dur.min', { m: Math.floor(s / 60), s: Math.floor(s % 60) });
    }

    // A project's tile: initials of a two-part name, else its first two
    // characters, in one of six colours the name always picks.
    function avatar(name) {
        var s = String(name || '');
        var parts = s.split(/[\s._-]+/).filter(Boolean);
        var h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        var text = parts.length >= 2 ? parts[0].charAt(0) + parts[1].charAt(0) : s.slice(0, 2);
        return '<span class="av" style="--pc:var(--p-' + (Math.abs(h) % 6) + ')">' + esc(text) + '</span>';
    }

    // One state chip; a session the phone holds or is attached to reads 手機接著.
    function chip(x) {
        var bg = (x.background || []).length;
        if (x.state === 'gate') return '<span class="st ask">' + ic('gate') + t('st.ask') + '</span>';
        if (x.state === 'idle') return '<span class="st idle">' + ic('kbd') + t('st.idle') + '</span>';
        if (x.state === 'holding' || x.attached) return '<span class="st held">' + ic('phone') + t('st.held') + '</span>';
        if (x.state === 'background') return '<span class="st bg">' + ic('bot') + t('st.bg', { n: bg }) + '</span>';
        return '<span class="st run">' + ic('activity') + t('st.run') + '</span>';
    }

    // The host pill: opens the 測站 sheet (the mockup's round 2: not a fourth tab).
    function hostHtml(m, u) {
        var host = m.host || t('host.station');
        return '<button type="button" class="host" data-act="sheet" aria-haspopup="dialog" aria-expanded="' + Boolean(u && u.sheet) + '" aria-label="' + esc(t('host.open', { host: host })) + '">'
            + ic('wifi', 'on') + esc(host) + ic('down', 'hc') + '</button>';
    }

    function bgList(items, at) {
        var shown = items.slice(0, 2).map(function (b) {
            return '<li>' + ic(b.type === 'shell' ? 'term' : 'bot') + '<span class="d">' + esc(b.description || b.command) + '</span>'
                + (num(b.since) ? '<span class="t">' + esc(ago(at - b.since)) + '</span>' : '') + '</li>';
        }).join('');
        return '<ul class="bgl" aria-label="' + t('bg.label') + '">' + shown
            + (items.length > 2 ? '<li class="more">' + t('home.more', { n: items.length - 2 }) + '</li>' : '') + '</ul>';
    }

    // A card's one status line.
    function stLine(x, at) {
        var bg = x.background || [];
        if (x.state === 'idle') return ic('pause') + '<span>' + t('home.stopped') + '</span>';
        if (x.state === 'holding' || x.attached) {
            return ic('phone') + '<span>' + (num(x.holdUntil) && x.holdUntil > at ? t('sc.held', { t: clock(x.holdUntil - at) }) : t('sc.attached')) + '</span>';
        }
        if (x.state === 'background' && bg.length) return ic(bg.some(function (b) { return b.type === 'shell'; }) ? 'term' : 'bot') + '<span>' + t('sc.bg', { n: bg.length }) + '</span>';
        return ic('activity') + '<span>' + t('chat.work') + '</span>';
    }

    // A session card: title, project, stage chip and one status line; the latest line and the
    // background list behind the chevron (round 3: progressive disclosure).
    function card(x, at, u, kind) {
        var key = 'sc:' + x.id;
        var open = Boolean(u.open && u.open[key]);
        var more = [];
        if (x.last && x.last.text) {
            more.push('<p class="sm-last">' + ic('msg') + '<span><b>' + t(x.last.role === 'assistant' ? 'who.ai' : x.last.role === 'phone' ? 'who.ph' : 'who.pc') + '</b>' + esc(x.last.text) + '</span></p>');
        }
        if ((x.background || []).length) more.push(bgList(x.background, at));
        return '<div class="sc' + (kind ? ' ' + kind : '') + '"><a class="sc-main" href="#/s/' + esc(x.id) + '"><span class="sc-top"><span class="sc-t">' + esc(x.task) + '</span>'
            + (num(x.updated) ? '<time>' + ic('clock') + esc(ago(at - x.updated)) + '</time>' : '') + '</span>'
            + '<span class="sc-meta">' + avatar(x.project) + '<span class="pj">' + esc(x.project) + '</span>' + stwI(x.stage) + '<span class="sp"></span>' + chip(x) + '</span>'
            + '<span class="sc-stat">' + stLine(x, at) + '</span></a>'
            + (more.length ? '<button type="button" class="sc-tog" data-act="fold" data-key="' + esc(key) + '" aria-expanded="' + open + '" aria-label="' + t(open ? 'sc.less' : 'sc.more') + '">' + ic('down') + '</button>'
                + (open ? '<div class="sc-more">' + more.join('') + '</div>' : '') : '')
            + '</div>';
    }

    // A held gate's card: the question in ink; on the 等你 tab (`wide`) its time left on its own
    // line and its options behind a tap.
    function askCard(x, m, at, u, wide) {
        var g = ((m.gates || []).filter(function (y) { return y.id === x.id; })[0]) || {};
        var q = (g.questions || [])[0];
        var opts = q && Array.isArray(q.options) ? q.options : [];
        var key = 'gp:' + x.id;
        var open = Boolean(u.open && u.open[key]);
        var left = num(g.until) ? ic('timer') + t(wide ? 'gc.left' : 'home.left', { t: clock(g.until - at) }) : '';
        var go = '<a class="sc-btn" href="#/s/' + esc(x.id) + '">' + t('home.go') + ic('chev') + '</a>';
        return '<div class="sc ask"><a class="sc-main" href="#/s/' + esc(x.id) + '"><span class="sc-top"><span class="sc-t">' + esc(x.task) + '</span></span>'
            + '<span class="sc-meta">' + avatar(x.project) + '<span class="pj">' + esc(x.project) + '</span>' + stwI(x.stage) + '</span>'
            + '<span class="sc-q">' + ic('ask') + '<span>' + esc((q && q.question) || '') + '</span></span></a>'
            + (wide
                ? (left ? '<p class="sc-left">' + left + '</p>' : '') + '<div class="sc-go">'
                    + (opts.length ? '<button type="button" class="sc-pv" data-act="fold" data-key="' + esc(key) + '" aria-expanded="' + open + '">' + ic('checks') + t('ask.opts', { n: opts.length }) + ic('down', 'tgl') + '</button>' : '')
                    + go + '</div>' + (open && opts.length ? '<ul class="gopt">' + optList(opts) + '</ul>' : '')
                : '<div class="sc-go"><span class="left">' + left + '</span>' + go + '</div>')
            + '</div>';
    }

    // The bottom tab bar (VoiceLedger's nav#tabs): Session, 等你 with its count, 完成.
    function tabbar(view, m) {
        var n = (m.tasks || []).filter(function (x) { return x.state === 'gate'; }).length + (m.stopped || []).length;
        var tab = function (href, v, icon, label, badge) {
            return '<a href="' + href + '"' + (view === v ? ' aria-current="page"' : '') + '><span class="tab-ico">' + ic(icon) + (badge || '') + '</span><span>' + label + '</span></a>';
        };
        return '<nav class="tabbar" aria-label="' + t('tab.nav') + '" data-block="m-tabbar">' + tab('#/', 'home', 'list', t('home.title'))
            + tab('#/ask', 'ask', 'gate', t('tab.ask'), n ? '<b class="tab-n" aria-label="' + esc(t('tab.n', { n: n })) + '">' + n + '</b>' : '')
            + tab('#/done', 'done', 'hist', t('done.title')) + '</nav>';
    }

    function homeHtml(m, at, u) {
        var tasks = m.tasks || [];
        var asks = tasks.filter(function (x) { return x.state === 'gate'; });
        var idle = tasks.filter(function (x) { return x.state === 'idle'; });
        var gone = m.stopped || [];
        var live = tasks.filter(function (x) { return x.state !== 'gate' && x.state !== 'idle'; })
            .map(function (x, i) { return { x: x, i: i }; })
            .sort(function (a, b) {
                var oa = ORDER[a.x.state] === undefined ? 3 : ORDER[a.x.state];
                var ob = ORDER[b.x.state] === undefined ? 3 : ORDER[b.x.state];
                return oa - ob || a.i - b.i;
            }).map(function (o) { return o.x; });
        var ask = function (x) { return askCard(x, m, at, u, false); };
        var one = function (x) { return card(x, at, u, x.state === 'idle' ? 'idle' : ''); };
        function group(block, icon, key, list, draw) {
            return list.length ? '<div data-block="' + block + '"><p class="ha-gh">' + ic(icon) + t(key) + ' <span>' + list.length + '</span></p><div class="sc-list">' + list.map(draw).join('') + '</div></div>' : '';
        }
        var any = tasks.length || gone.length;
        var body = !any ? '<div class="empty"><h2>' + t('home.empty') + '</h2></div>'
            : group('m-home-ask', 'ask', 'grp.ask', asks, ask) + group('m-home-run', 'activity', 'grp.run', live, one)
                + group('m-home-idle', 'pause', 'grp.idle', idle, one) + group('m-home-gone', 'gate', 'grp.gone', gone, ask);
        var sum = any ? '<div class="ab-2"><p class="ha-sum"><span class="a">' + ic('ask') + t('sum.ask', { n: asks.length }) + '</span><span class="r">' + ic('activity') + t('sum.run', { n: live.length })
            + '</span><span class="i">' + ic('pause') + t('sum.idle', { n: idle.length }) + '</span></p></div>' : '';
        return '<div class="pg" data-block="m-home-a"><header class="ab ab2"><div class="ab-1"><h1>' + t('home.title') + '</h1>' + (tasks.length ? '<span class="n">' + tasks.length + '</span>' : '')
            + '<span class="sp"></span>' + hostHtml(m, u) + '</div>' + sum + '</header>'
            + '<div class="ha-body">' + body + '</div></div>' + tabbar('home', m);
    }

    function askHtml(m, at, u) {
        var list = (m.tasks || []).filter(function (x) { return x.state === 'gate'; }).concat(m.stopped || []);
        return '<div class="pg" data-block="m-ask-a"><header class="ab tab-ab"><div class="ab-1"><h1>' + t('grp.ask') + '</h1>' + (list.length ? '<span class="n">' + list.length + '</span>' : '')
            + '<span class="sp"></span>' + hostHtml(m, u) + '</div></header><div class="ha-body">'
            + (list.length ? '<div class="sc-list" data-block="m-ask-list">' + list.map(function (x) { return askCard(x, m, at, u, true); }).join('') + '</div>'
                : '<div class="empty"><h2>' + t('ask.empty') + '</h2></div>')
            + '</div></div>' + tabbar('ask', m);
    }

    // The 測站 sheet from the host pill: the connection on one line, then this phone, the session
    // it holds and re-pairing, each opening on a tap. Unpairing has no phone route
    // (/station/remote/revoke is LOCAL in lib/remote.js), so the row says where on the desktop.
    function sheetHtml(m, at, u) {
        var me = m.device || null;
        var held = (m.tasks || []).filter(function (x) { return num(x.holdUntil) && x.holdUntil > at; })[0] || null;
        var paired = me && num(me.paired) ? md(me.paired) : '';
        function row(key, icon, k, v, side, body) {
            var open = Boolean(u.open && u.open[key]);
            return '<li class="rs-i' + (open ? ' open' : '') + '"><button type="button" class="rs-row" data-act="fold" data-key="' + key + '" aria-expanded="' + open + '">' + ic(icon)
                + '<span class="rs-m"><span class="rs-k">' + k + '</span><span class="rs-v">' + v + '</span></span><span class="rs-side">' + side + '</span>' + ic('down', 'tgl') + '</button>'
                + (open ? '<div class="rs-x">' + body + '</div>' : '') + '</li>';
        }
        return '<div class="rs-scrim" data-act="sheet" aria-hidden="true"></div><div class="rs" role="dialog" aria-modal="true" aria-labelledby="rs-t" data-block="m-remote-sheet"><span class="rs-grab" aria-hidden="true"></span>'
            + '<div class="rs-h"><h2 id="rs-t">' + ic('server') + t('host.station') + '</h2><span class="sp"></span><span class="on">' + ic('wifi') + esc(t('host.on', { host: m.host || '' })) + '</span>'
            + (num(m.at) ? '<time>' + ic('clock') + hm(m.at) + '</time>' : '') + '</div><ul class="rs-list">'
            + row('rs:me', 'phone', t('rs.me'), esc(me ? me.name : t('rs.local')), paired ? t('rs.paired', { d: paired }) : '', '<p>' + ic('info') + '<span>' + t(me ? 'rs.unpair' : 'rs.localWhy') + '</span></p>')
            + (held ? row('rs:held', 'link', t('st.held'), esc(held.task), t('home.left', { t: clock(held.holdUntil - at) }),
                '<p>' + ic('hourglass') + '<span>' + t('rs.hold') + '</span></p><button type="button" class="give" data-act="detach" data-id="' + esc(held.id) + '">' + ic('laptop') + t('give') + '</button>') : '')
            + row('rs:pair', 'refresh', t('off.repair'), t('rs.pairV'), '', '<p>' + ic('qr') + '<span>' + t('rs.pairWhy') + '</span></p><button type="button" class="ghost" data-act="repair">' + ic('qr') + t('off.repair') + '</button>')
            + '</ul>' + (u.note ? '<p class="note" role="status">' + esc(u.note) + '</p>' : '') + '</div>';
    }

    // Claude's words: paragraphs on blank lines, `code`, line breaks; cut long.
    function prose(text) {
        var s = String(text || '');
        if (s.length > MSG_CAP) s = s.slice(0, MSG_CAP) + '…';
        return s.split(/\n\s*\n/).map(function (p) {
            return '<p>' + esc(p.trim()).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>') + '</p>';
        }).join('');
    }

    // A turn the harness injected through UserPromptSubmit (a subagent's hand-back, a background-task
    // notice, a system reminder) is logged as the desktop user's text; it is not something the user said.
    var HARNESS = /^\s*<(agent-message|task-notification|system-reminder)\b/;
    function harness(text) {
        var m = HARNESS.exec(String(text || ''));
        if (!m) return null;
        var s = String(text).trim(), kind = m[1], body;
        if (kind === 'agent-message') {
            var f = s.slice(0, 600).search(/follows:/);
            body = f >= 0 ? s.slice(f + 8) : s.replace(/^<agent-message\b[^>]*>/, '');
            body = body.replace(/<\/agent-message>\s*$/, '');
            var lines = body.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
            var ind = Math.min.apply(null, lines.filter(function (l) { return l.trim(); }).map(function (l) { return /^ */.exec(l)[0].length; }));
            body = lines.map(function (l) { return isFinite(ind) ? l.slice(ind) : l; }).join('\n');
        } else if (kind === 'task-notification') {
            var sm = /<summary>([\s\S]*?)<\/summary>/.exec(s), rs = /<result>([\s\S]*?)<\/result>/.exec(s);
            body = sm || rs ? [sm && sm[1], rs && rs[1]].filter(Boolean).map(function (x) { return x.trim(); }).join('\n\n') : s.replace(/<[^>]+>/g, '');
        } else body = s.replace(/<[^>]+>/g, '');
        return { label: t(kind === 'agent-message' ? 'hx.agent' : kind === 'task-notification' ? 'hx.note' : 'hx.sys'), body: body.trim() };
    }

    function bubble(role, text, at, sent, fold) {
        var when = num(at) ? ' <time>' + hm(at) + '</time>' : '';
        var hx = role === 'desktop' ? harness(text) : null;
        if (hx) {
            var one = hx.body.replace(/\s+/g, ' ').slice(0, 60);
            return '<div class="msg rpt-row"><details data-k="' + esc(String(at) + ':' + String(text).length) + '"><summary><b>' + hx.label + '</b>' + when + '<span class="ex">' + esc(one) + '</span></summary>'
                + '<div class="rpt-b">' + prose(hx.body) + '</div></details></div>';
        }
        if (role === 'assistant') {
            var more = fold ? '<button type="button" class="rep-more" data-act="more" aria-expanded="' + (fold.open ? 'true' : 'false') + '">' + t(fold.open ? 'rep.less' : 'rep.more') + '</button>' : '';
            return '<div class="msg ai' + (fold ? ' rep' + (fold.open ? ' open' : '') : '') + '"><span class="who">' + t('who.ai') + when + '</span><div class="bub">' + prose(text) + '</div>' + more + '</div>';
        }
        var pc = role === 'desktop';
        return '<div class="msg me ' + (pc ? 'pc' : 'ph') + '"><span class="who">' + ic(pc ? 'laptop' : 'phone') + t(pc ? 'who.pc' : 'who.ph') + when + '</span>'
            + '<p class="bub">' + esc(text) + '</p>' + (sent ? '<span class="sent">' + sent + '</span>' : '') + '</div>';
    }

    function stepRow(s, at) {
        if (s.end === null || s.end === undefined) {
            return '<li class="tl-row now">' + ic('spin') + '<span class="lb"><span><b>' + t('steps.now', { label: esc(s.label) }) + '</b></span></span>'
                + '<span class="tm">' + (num(s.at) ? clock(at - s.at) : '') + '</span></li>';
        }
        var took = num(s.at) && num(s.end) ? dur(s.end - s.at) : '';
        if (s.ok === false) {
            return '<li class="tl-row fail">' + ic(TOOL_IC[s.tool] || 'chev') + '<span class="lb"><span>' + esc(s.label) + '</span></span>'
                + '<span class="tm"><span class="bad"><i></i>' + t('steps.fail') + '</span>' + took + '</span></li>';
        }
        return '<li class="tl-row done">' + ic('check') + '<span class="lb"><span>' + esc(s.label) + '</span></span><span class="tm">' + took + '</span></li>';
    }

    // A turn's steps: one line once it is over (a tap opens them all); the
    // turn still running shows its last three rows under how long it has run.
    function stepsHtml(g, live, at, open) {
        var items = g.items;
        var key = String((items[0] && items[0].id) || '');
        if (live) {
            var first = items[0] && num(items[0].at) ? items[0].at : at;
            var head = [t('steps.n', { n: items.length }), t('steps.ran', { t: clock(at - first) })]
                .concat(items.length > 3 ? [t('steps.folded', { n: items.length - 3 })] : []).join(' · ');
            return '<div class="tl" data-block="m-tools" role="status"><p class="tl-sum">' + head + '</p><ol class="tl-list">'
                + items.slice(-3).map(function (s) { return stepRow(s, at); }).join('') + '</ol></div>';
        }
        var shown = Boolean(open && open[key]);
        return '<div class="tl" data-block="m-tools"><button type="button" class="tl-sum" data-act="steps" data-key="' + esc(key) + '" aria-expanded="' + shown + '">'
            + ic('chev', 'chev') + esc(stepsLine(items)) + '</button>'
            + (shown ? '<ol class="tl-list">' + items.map(function (s) { return stepRow(s, at); }).join('') + '</ol>' : '') + '</div>';
    }

    function bgPanel(items, at) {
        return '<section class="bgp" aria-label="' + t('bg.label') + '"><div class="bgp-h"><span class="st bg"><i class="lv"></i>' + t('bg.still') + '</span><b>'
            + t('bg.head', { n: items.length }) + '</b><span class="sp"></span></div><ol>'
            + items.map(function (b) {
                return '<li class="bgp-i"><span class="k">' + ic(b.type === 'shell' ? 'term' : 'bot') + '</span><span class="d"><b>' + esc(b.description || b.command) + '</b>'
                    + '<small>' + t('bg.start', { kind: esc(b.type), t: num(b.since) ? hm(b.since) : '' }) + '</small></span>'
                    + '<span class="t">' + (num(b.since) ? esc(ago(at - b.since)) : '') + '<span><i class="lv"></i>' + t('bg.run') + '</span></span></li>';
            }).join('') + '</ol><p class="bgp-f">' + ic('cc') + t('bg.foot') + '</p></section>';
    }

    function gateCard(p, at, u) {
        var g = p.gate || {};
        var body = (g.questions || []).map(function (q, qi) {
            var opts = Array.isArray(q.options) ? q.options : [];
            var type = q.multiSelect ? 'checkbox' : 'radio';
            return (qi ? '<p class="gc-q" id="gc-q' + qi + '">' + esc(q.question || '') + '</p>' : '')
                + '<fieldset class="opts" data-voice><legend class="vh">' + t(q.multiSelect ? 'gate.pickMany' : 'gate.pick') + '</legend>'
                + opts.map(function (o) { return optionHtml(q, qi, o, REC.test(String((o && o.label) || ''))); }).join('')
                + '<label class="opt other"><input type="' + type + '" name="q' + qi + '" value="__other"><span class="rd" aria-hidden="true"></span>'
                + '<textarea class="own" id="gc-own' + qi + '" data-own="' + qi + '" rows="1" placeholder="' + t('gate.own') + '" aria-label="' + t('gate.own') + '"></textarea>'
                + (u.mic ? '<button type="button" class="gmic" data-mic="gc-own' + qi + '" aria-label="' + t('mic.answer') + '">' + ic('mic') + '</button>' : '')
                + '</label><label class="gmic" aria-label="' + t('pic.label') + '"><input type="file" accept="image/*" hidden data-pic>' + ic('image') + '</label><p class="gc-say" data-say>' + (u.mic ? t('mic.hint') : '') + '</p></fieldset>';
        }).join('');
        return '<form class="gc gopts" id="gate-card" data-id="' + esc(p.id) + '" aria-labelledby="gpin-q">'
            + '<div class="gc-b">' + body + '<p class="gc-st" role="status"></p><button type="submit" class="cta">' + t('gate.send') + '</button></div></form>';
    }

    // What .cv holds: the conversation, the steps, and the state's own last
    // card — the one part a poll redraws while the bar below stays.
    function cvInner(p, at, u) {
        var turns = turnsOf(p.chat);
        var live = p.state === 'running' || p.state === 'gate';
        var lastPhone = -1;
        turns.forEach(function (g, i) { if (g.kind === 'msg' && g.role === 'phone') lastPhone = i; });
        var lastAi = -1;
        turns.forEach(function (g, i) { if (g.kind === 'msg' && g.role === 'assistant') lastAi = i; });
        var fold = function (i) { return p.state === 'gate' && i === lastAi ? { open: Boolean(u.rep) } : null; };
        var openLast = live && turns.length && turns[turns.length - 1].kind === 'steps';
        var out = turns.map(function (g, i) {
            if (g.kind === 'steps') return stepsHtml(g, openLast && i === turns.length - 1, at, u.open);
            if (g.role !== 'desktop' && g.role !== 'phone' && g.role !== 'assistant') return '';
            return bubble(g.role, g.text, g.at, i === lastPhone ? ic('check') + t('chat.sent') : '', fold(i));
        }).join('');
        if (p.state === 'running' && !openLast) {
            var start = null;
            turns.forEach(function (g) { if (g.kind === 'msg' && g.role !== 'assistant' && num(g.at)) start = g.at; });
            out += '<div class="work" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><b>' + t('chat.work') + '</b>'
                + (start !== null ? '<span class="mono">' + esc(ago(at - start)) + '</span>' : '') + '</div>';
        }
        if (p.waiting) out += bubble('phone', p.waiting.text, p.waiting.at, t('chat.queued'));
        if (p.state === 'background') out += bgPanel(p.background || [], at);
        if (p.state === 'idle') out += '<p class="ev"><span>' + ic('pause') + t('home.stopped') + '</span></p>';
        if (p.state === 'gate') out += gateCard(p, at, u);
        return out;
    }

    function fitEdge(w, h, edge) {
        var s = Math.min(1, edge / Math.max(w, h));
        return { w: Math.round(w * s), h: Math.round(h * s) };
    }

    // The photo drawn on a canvas at PH_EDGE as JPEG PH_Q, on white (a transparent PNG would turn
    // black). A browser with no createImageBitmap, or one that cannot decode the photo, sends it as picked.
    function shrink(win, file) {
        if (!win || !win.createImageBitmap || !win.document || !win.document.createElement) return Promise.resolve(file);
        return win.createImageBitmap(file).then(function (bmp) {
            var to = fitEdge(bmp.width, bmp.height, PH_EDGE);
            var c = win.document.createElement('canvas');
            c.width = to.w;
            c.height = to.h;
            var g = c.getContext('2d');
            g.fillStyle = '#fff';
            g.fillRect(0, 0, to.w, to.h);
            g.drawImage(bmp, 0, 0, to.w, to.h);
            if (bmp.close) bmp.close();
            return new Promise(function (ok) { c.toBlob(function (b) { ok(b || file); }, 'image/jpeg', PH_Q); });
        }, function () { return file; });
    }

    function pending(u) {
        var at = -1;
        (u.photos || []).forEach(function (x, i) { if (!x.path && at < 0) at = i; });
        return at;
    }
    function canSend(p, u) { return !p.waiting && pending(u) < 0 && Boolean(String(u.draft || '').trim() || (u.photos || []).length); }
    function hintOf(p, u) {
        var waiting = Boolean(p.waiting);
        var up = pending(u);
        var hint = waiting ? t('cmp.waiting') : up >= 0 ? t('ph.wait', { n: up + 1 }) : p.state === 'holding' ? t('cmp.held') : t('cmp.next');
        return ic('phone') + hint + (u.mic && !waiting && up < 0 ? ' · ' + t('cmp.voice') : '');
    }
    function ring(pct) {
        return '<span class="ring" role="img" aria-label="' + esc(t('ph.up', { n: pct })) + '"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" pathLength="100"/>'
            + '<circle class="v" cx="18" cy="18" r="15" pathLength="100" style="stroke-dasharray:' + pct + ' 100"/></svg><b>' + pct + '</b></span>';
    }
    // The strip, the fifth-photo hint, the count and the limits: what a pick, a remove or an
    // upload's progress draws again into #ph-box, never touching the field.
    function photosHtml(u) {
        var list = u.photos || [];
        if (!list.length) return '';
        return '<ul class="ph-strip" aria-label="' + t('ph.list') + '">' + list.map(function (x, i) {
            return '<li class="ph">' + (x.url ? '<img src="' + esc(x.url) + '" alt="' + esc(t('ph.alt', { n: i + 1 })) + '">' : ic('image')) + (x.path ? '' : ring(x.pct || 0))
                + '<button type="button" class="ph-x" data-act="ph-x" data-key="' + esc(x.key) + '" aria-label="' + esc(t('ph.x', { n: i + 1 })) + '"><span>' + ic('x') + '</span></button></li>';
        }).join('')
            + (list.length < PH_MAX ? '<li><button type="button" class="ph-add" data-act="ph-add" aria-label="' + esc(t('ph.add', { n: PH_MAX - list.length })) + '">' + ic('imgplus') + '</button></li>' : '') + '</ul>'
            + (u.over ? '<p class="ph-hint" role="status">' + ic('alert') + t('ph.over', { n: PH_MAX }) + '</p>' : '')
            + '<div class="ph-meta"><span class="ph-n">' + ic('images') + list.length + '/' + PH_MAX + '</span><span class="sep">·</span>'
            + '<details class="ph-lim"' + (u.lim ? ' open' : '') + '><summary data-act="lim">' + ic('info') + t('ph.lim', { n: PH_MAX, px: PH_EDGE }) + ic('down', 'tgl') + '</summary>'
            + '<p>' + t('ph.limWhy', { px: PH_EDGE, q: PH_Q }) + '</p></details></div>';
    }

    function composer(p, u) {
        var waiting = Boolean(p.waiting);
        return '<form class="cmp" id="composer" data-block="m-composer-a"><div class="ph-box" id="ph-box">' + photosHtml(u) + '</div>'
            + '<div class="cmp-row v2' + (u.mic ? '' : ' no-mic') + '">'
            + (u.mic ? '<button type="button" class="mic" data-mic="cmp-box" aria-label="' + t('mic.label') + '">' + ic('mic') + '</button>' : '')
            + '<div class="cmp-field"><label class="vh" for="cmp-box">' + t('cmp.label') + '</label>'
            + '<textarea id="cmp-box" name="text" rows="1" placeholder="' + t('cmp.ph') + '"' + (waiting ? ' disabled' : '') + '>' + esc(String(u.draft || '')) + '</textarea>'
            + '<label class="gmic" aria-label="' + t('ph.pick') + '"><input type="file" id="cmp-file" accept="image/*" multiple hidden>' + ic('imgplus') + '</label></div>'
            + '<button type="submit" class="send" aria-label="' + t('cmp.send') + '"' + (canSend(p, u) ? '' : ' disabled') + '>' + ic('up') + '</button></div>'
            + '<p class="cmp-hint" data-say>' + hintOf(p, u) + '</p></form>';
    }

    // The question stays under the header while the report scrolls; 看選項 jumps to the answers.
    function gpinHtml(p, at, u) {
        var g = p.gate || {}, q = (g.questions || [])[0];
        if (!q) return '';
        return '<div class="gpin' + (u.pin ? ' open' : '') + '" role="region" aria-labelledby="gpin-q"><p class="gpin-h">' + ic('gate') + t('gc.head', { stage: esc(p.stage) })
            + (num(g.until) ? '<span class="left">' + t('gc.left', { t: clock(g.until - at) }) + '</span>' : '') + '<span class="sp"></span>'
            + '<button type="button" class="gpin-go" data-act="gate">' + t('gpin.go') + ic('chev') + '</button></p>'
            + '<p class="gpin-q" id="gpin-q" data-act="gpin" tabindex="0" role="button" aria-expanded="' + (u.pin ? 'true' : 'false') + '">' + esc(q.question || '') + '</p></div>';
    }

    // The TokenBar: context against the compact line (or the window when the pane knows it),
    // and the 5h and 7d limits with where the time says they should be.
    function meters(p, at) {
        var c = p.context || null;
        var l = p.limits || {};
        var wnd = c && num(c.window) && c.window > 0 ? c.window : null;
        var line = c && num(c.at) && c.at > 0 ? c.at : null;
        var of = wnd || line;
        var resets = function (r, span) {
            return num(r) ? t('tk.resets', { t: (span === SEVEN_MS ? md(r) + ' ' : '') + hm(r), n: paceOf(r, span, at) }) : t('tk.none');
        };
        return [
            { icon: 'brain', label: t('tk.ctx'), v: c && of ? pct(c.tokens / of * 100) : null, mark: wnd && line ? pct(line / wnd * 100) : null,
                sub: c ? kTok(c.tokens) + (of ? ' / ' + kTok(of) : '') + (wnd && line ? t('tk.at', { n: kTok(line) }) : !wnd && line ? t('tk.ofAt') : '') : t('tk.none') },
            { icon: 'timer', label: t('tk.five'), v: pct(l.five), mark: paceOf(l.fiveResets, FIVE_MS, at), sub: resets(l.fiveResets, FIVE_MS) },
            { icon: 'calclock', label: t('tk.seven'), v: pct(l.seven), mark: paceOf(l.sevenResets, SEVEN_MS, at), sub: resets(l.sevenResets, SEVEN_MS) },
        ];
    }

    function tokenInner(p, at, u) {
        var ms = meters(p, at);
        var open = Boolean(u.open && u.open.tk);
        var val = function (v) { return v === null ? '—' : v + '%'; };
        return '<button type="button" class="tkm" data-act="fold" data-key="tk" aria-expanded="' + open + '" aria-controls="tkx" aria-label="' + esc(t('tk.aria', { c: val(ms[0].v), f: val(ms[1].v), s: val(ms[2].v) })) + '">'
            + ms.map(function (x) { return '<span class="tkm-i">' + ic(x.icon) + '<span class="mb"><i style="--v:' + (x.v || 0) + '%"></i></span><b>' + val(x.v) + '</b></span>'; }).join('')
            + ic('down', 'tgl') + '</button>'
            + (open ? '<div class="tkx" id="tkx">' + ms.map(function (x) {
                return '<div class="tkx-r">' + ic(x.icon) + '<span class="tkx-l">' + x.label + '</span><b class="tk-v">' + val(x.v) + '</b>'
                    + '<span class="tk-bar"><i style="--v:' + (x.v || 0) + '%"></i>' + (x.mark === null ? '' : '<b style="--p:' + x.mark + '%"></b>') + '</span>'
                    + '<span class="tk-s">' + esc(x.sub) + '</span></div>';
            }).join('') + '</div>' : '');
    }

    function panesNav(p, pane) {
        var bg = (p.background || []).length;
        return '<nav class="panes" aria-label="' + t('pn.nav') + '" data-block="m-pane-tabs">' + PANES.map(function (x) {
            return '<a href="#/s/' + esc(p.id) + '/' + x[0] + '"' + (x[0] === pane ? ' aria-current="page"' : '') + '>' + ic(x[1]) + '<span>' + t('pn.' + x[0]) + '</span>'
                + (x[0] === 'dispatch' && bg ? '<i class="dot live" aria-label="' + esc(t('pn.bg', { n: bg })) + '"></i>' : '') + '</a>';
        }).join('') + '</nav>';
    }

    // The desktop page for what the phone draws only a summary of.
    function full(p, tab) { return '<a class="ov-link" href="/f/' + esc(p.id) + '/' + tab + '">' + ic('laptop') + t('ov.full') + '</a>'; }
    function empty(key) { return '<p class="ov-empty">' + ic('info') + t(key) + '</p>'; }
    // One summary row of the list panes: an icon, a label over its time, the chevron; open, its details.
    function evRow(key, u, icon, label, time, side, more) {
        var open = Boolean(u.open && u.open[key]);
        return '<li class="ov-r ev' + (open ? ' open' : '') + '"><button type="button" class="ov-b ev" data-act="fold" data-key="' + esc(key) + '" aria-expanded="' + open + '">' + icon
            + '<span class="lb">' + label + '</span><span class="tm">' + time + '</span>' + (side ? '<b class="usd">' + side + '</b>' : '') + ic('down', 'tgl') + '</button>'
            + (open ? more : '') + '</li>';
    }
    function dl(rows) {
        return '<dl class="ov-x">' + rows.filter(Boolean).map(function (r) { return '<div><dt>' + ic(r[0]) + r[1] + '</dt><dd>' + r[2] + '</dd></div>'; }).join('') + '</dl>';
    }

    // 概覽: this session's finished stages from mobile.json's done rows, how long each took and what it cost.
    function overviewInner(p, m, at, u) {
        var rows = (m.done || []).filter(function (x) { return x.id === p.id && x.kind === 'stage'; }).sort(function (a, b) { return a.at - b.at; });
        var end = (m.done || []).filter(function (x) { return x.id === p.id && x.kind === 'end'; })[0];
        if (!rows.length) return empty('ov.empty') + full(p, 'timeline');
        var total = 0;
        var top = 0;
        rows.forEach(function (x) { if (num(x.usd)) { total += x.usd; top = Math.max(top, x.usd); } });
        var list = rows.map(function (x, i) {
            var key = 'ov:' + x.stage + ':' + x.at;
            var open = Boolean(u.open && u.open[key]);
            var span = i ? x.at - rows[i - 1].at : null;
            var share = total > 0 && num(x.usd) ? Math.round(x.usd / total * 100) : null;
            return '<li class="ov-r' + (open ? ' open' : '') + '"><button type="button" class="ov-b" data-act="fold" data-key="' + esc(key) + '" aria-expanded="' + open + '">'
                + stwI(x.stage) + '<span class="tm">' + ic('clock') + (span === null ? t('ov.doneAt', { t: hm(x.at) }) : esc(took(span))) + '</span>'
                + '<span class="bar" style="--c:' + stVar(x.stage) + '"><i style="--v:' + (top > 0 && num(x.usd) ? Math.round(x.usd / top * 100) : 0) + '%"></i></span>'
                + '<b class="usd">' + usd(x.usd) + '</b>' + ic('down', 'tgl') + '</button>'
                + (open ? dl([['cc', t('ov.at'), hm(x.at)], span === null ? null : ['timer', t('ov.took'), t('ov.tookV', { t: esc(took(span)) })],
                    ['coins', t('ov.cost'), usd(x.usd) + (share === null ? '' : t('ov.share', { n: share }))]]) : '') + '</li>';
        }).join('');
        return '<p class="ov-sum">' + ic('coins') + '<b class="usd">' + usd(total) + '</b><span>' + t('ov.sum', { n: rows.length, from: hm(rows[0].at), to: hm(rows[rows.length - 1].at) }) + '</span></p>'
            + '<ol class="ov-list">' + list + '</ol>'
            + (end ? '<p class="ov-end"><span class="end">' + ic('flag') + t('done.end') + '</span><span>' + hm(end.at) + '</span></p>' : '') + full(p, 'timeline');
    }

    // 計畫: phone.json carries no plan tasks, so the route — done, in progress, not yet — and the desktop plan page.
    function planInner(p, m, at, u) {
        var route = (p.route || []).filter(function (s) { return typeof s === 'string'; });
        if (!route.length) return empty('pl.empty') + full(p, 'plan');
        var cur = route.indexOf(p.stage);
        var done = (m.done || []).filter(function (x) { return x.id === p.id && x.kind === 'stage'; });
        return '<ol class="ov-list">' + route.map(function (s, i) {
            var hit = done.filter(function (x) { return x.stage === s; }).pop();
            var state = hit || (cur >= 0 && i < cur) ? 'done' : i === cur ? 'now' : 'todo';
            return evRow('pl:' + s, u, ic(state === 'done' ? 'cc' : state === 'now' ? 'activity' : 'clock'), stwI(s), t('pl.' + state), hit ? usd(hit.usd) : '',
                dl([['cc', t('ov.at'), hit ? hm(hit.at) : t('pl.notyet')]]));
        }).join('') + '</ol>' + full(p, 'plan');
    }

    // 派工: the agents and shells still running in the background.
    function dispatchInner(p, at, u) {
        var list = p.background || [];
        if (!list.length) return empty('dp.empty') + full(p, 'dispatch');
        return '<ol class="ov-list">' + list.map(function (b, i) {
            return evRow('dp:' + (b.id || i), u, ic(b.type === 'shell' ? 'term' : 'bot'), esc(b.description || b.command), (num(b.since) ? esc(ago(at - b.since)) + ' · ' : '') + t('bg.run'), '',
                dl([['layers', t('dp.kind'), esc(b.type || '')], b.command ? ['term', t('dp.cmd'), esc(b.command)] : null, num(b.since) ? ['clock', t('dp.start'), hm(b.since)] : null]));
        }).join('') + '</ol>' + full(p, 'dispatch');
    }

    // 事件: the conversation's tool steps, newest first.
    function eventsInner(p, at, u) {
        var steps = [];
        turnsOf(p.chat).forEach(function (g) { if (g.kind === 'steps') steps = steps.concat(g.items); });
        steps = steps.slice(-30).reverse();
        if (!steps.length) return empty('ev.empty');
        return '<ol class="ov-list">' + steps.map(function (s) {
            var live = s.end === null || s.end === undefined;
            var icon = live ? ic('spin') : s.ok === false ? ic('alert') : ic(TOOL_IC[s.tool] || 'check');
            var time = live ? (num(s.at) ? clock(at - s.at) : '') : num(s.at) && num(s.end) ? dur(s.end - s.at) : '';
            return evRow('ev:' + s.id, u, icon, esc(s.label), (s.ok === false ? t('steps.fail') + ' · ' : '') + time, '',
                dl([['term', t('ev.tool'), esc(s.tool || '')], num(s.at) ? ['clock', t('ev.start'), hm(s.at)] : null, time ? ['timer', t('ev.took'), time] : null]));
        }).join('') + '</ol>';
    }

    // 關卡: the held gate's questions, each opening on its options; 去答 goes to the card in 對話.
    function gateInner(p, at, u) {
        var qs = (p.gate && p.gate.questions) || [];
        if (!qs.length) return empty('gt.empty');
        return (num(p.gate.until) ? '<p class="sc-left">' + ic('timer') + t('gc.left', { t: clock(p.gate.until - at) }) + '</p>' : '')
            + '<ol class="ov-list">' + qs.map(function (q, qi) {
                var opts = Array.isArray(q.options) ? q.options : [];
                return evRow('gt:' + qi, u, ic('ask'), esc(q.question || ''), t('ask.opts', { n: opts.length }), '', '<ul class="gopt">' + optList(opts) + '</ul>');
            }).join('') + '</ol><p class="ov-end"><a class="sc-btn" href="#/s/' + esc(p.id) + '/talk">' + t('home.go') + ic('chev') + '</a></p>';
    }

    function paneInner(p, pane, at, u, m) {
        if (pane === 'timeline') return overviewInner(p, m || {}, at, u);
        if (pane === 'plan') return planInner(p, m || {}, at, u);
        if (pane === 'dispatch') return dispatchInner(p, at, u);
        if (pane === 'events') return eventsInner(p, at, u);
        if (pane === 'gate') return gateInner(p, at, u);
        return cvInner(p, at, u);
    }

    // One session: its header, the TokenBar and the pane tabs on top, then the pane; 對話 keeps
    // the gate pin, the composer or the attach / idle card. No tab bar: it is a drill-down.
    function chatHtml(m, id, at, u, P, pane) {
        var row = (m.tasks || []).concat(m.stopped || []).filter(function (x) { return x.id === id; })[0];
        // Until its phone.json arrives, the session's mobile.json row stands in.
        var p = P || (row ? Object.assign({}, row, { chat: row.last ? [row.last] : [], waiting: null, gate: null }) : null);
        var back = '<a class="bk" href="#/" aria-label="' + t('chat.back') + '">' + ic('back') + '</a>';
        if (!p) return '<div class="pg dt"><header class="ch-h">' + back + '<span></span><span></span></header><div class="empty"><h2>' + t('chat.gone') + '</h2></div></div>';
        if (p.state === 'gate' && !p.gate) p = Object.assign({}, p, { gate: (m.gates || []).filter(function (g) { return g.id === id; })[0] || null });
        var attached = p.attached && p.state !== 'gate' && p.state !== 'idle';
        var side = attached ? '<button type="button" class="give" data-act="detach">' + ic('laptop') + t('give') + '</button>'
            : p.state === 'idle' ? '<span class="ro">' + ic('eye') + t('ro') + '</span>' : '<span></span>';
        var body;
        if (pane === 'talk') {
            var bottom = '';
            if (p.state === 'idle') {
                bottom = '<div class="idl" role="note"><h3><span class="ic-w">' + ic('kbd') + '</span>' + t('idle.title') + '</h3><p>' + t('idle.why') + '</p>'
                    + '<dl><dt>' + t('idle.give.t') + '</dt><dd>' + t('idle.give') + '</dd><dt>' + t('idle.wait.t') + '</dt><dd>' + t('idle.wait') + '</dd></dl></div>';
            } else if (p.state === 'holding' || attached) {
                bottom = composer(p, u);
            } else if (p.state === 'running' || p.state === 'background') {
                bottom = '<div class="att"><button type="button" class="cta" data-act="attach">' + ic('phone') + t('att.go') + '</button><p>'
                    + t(p.state === 'background' ? 'att.bg' : 'att.run') + '</p></div>';
            }
            body = (p.state === 'gate' && p.gate ? gpinHtml(p, at, u) : '')
                + '<div class="cv" role="log" aria-label="' + t('chat.log') + '">' + cvInner(p, at, u) + '</div>'
                + (u.note ? '<p class="note" role="status">' + esc(u.note) + '</p>' : '') + bottom;
        } else {
            body = '<div class="ov" data-block="m-pane-' + pane + '" role="region" aria-label="' + t('pn.' + pane) + '">' + paneInner(p, pane, at, u, m) + '</div>';
        }
        return '<div class="pg dt" ' + SCREEN[attached ? 'attached' : p.state] + '><div class="dt-top"><header class="ch-h">' + back
            + '<div><p class="ch-t">' + esc(p.task) + '</p><p class="ch-m">' + avatar(p.project) + esc(p.project) + stwI(p.stage) + chip(p) + '</p></div>' + side + '</header>'
            + '<div class="tkb" data-block="m-tokenbar">' + tokenInner(p, at, u) + '</div>' + panesNav(p, pane) + '</div>' + body + '</div>';
    }

    function optList(opts) {
        return opts.map(function (o) {
            var l = String((o && o.label) || '');
            var rec = REC.test(l);
            return '<li>' + ic('cc', rec ? '' : 'no') + '<span>' + esc(l.replace(REC, '')) + '</span>' + (rec ? '<span class="gq-rec">' + t('gate.rec') + '</span>' : '') + '</li>';
        }).join('');
    }

    function optionHtml(q, qi, o, on) {
        var label = String((o && o.label) || '');
        var shown = label.replace(REC, '');
        return '<label class="opt"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="' + esc(label) + '"' + (on ? ' checked' : '') + '>'
            + '<span class="rd" aria-hidden="true"></span><span class="opt-l">' + esc(shown) + (shown !== label ? '<span class="gq-rec">' + t('gate.rec') + '</span>' : '') + '</span>'
            + (o && o.description ? '<span class="opt-d">' + esc(o.description) + '</span>' : '') + '</label>';
    }

    function doneRow(x) {
        var meta = x.kind === 'end'
            ? '<span class="end">' + ic('flag') + t('done.end') + '</span>'
            : stw(x.stage) + '<span class="dn">' + ic('cc') + t('done.dn') + '</span>';
        return '<a class="row' + (x.kind === 'end' ? ' fin' : '') + '" href="/f/' + esc(x.id) + '/' + esc(x.stage || 'gate') + '">'
            + '<div class="r-l"><div class="r-meta">' + meta + '<span class="pj">' + esc(x.project) + '</span></div><p class="r-t">' + esc(x.task) + '</p></div>'
            + '<div class="r-side"><span class="usd">' + usd(x.usd) + '</span><span class="ago">' + ic('clock') + hm(x.at) + '</span></div></a>';
    }

    function doneScreen(m, at, u) {
        return '<div class="pg" data-block="m-done-a"><header class="ab tab-ab"><div class="ab-1"><h1>' + t('done.title') + '</h1><span class="sp"></span>' + hostHtml(m, u) + '</div></header>'
            + doneHtml(m, at) + '</div>' + tabbar('done', m);
    }

    // Newest first as mobile.json sends it, under one heading per day.
    function doneHtml(M, now) {
        var done = M.done || [];
        if (!done.length) return '<div class="body" data-block="tab-done"><div class="empty"><h2>' + t('done.empty') + '</h2></div></div>';
        var today = dayOf(now);
        var yday = dayOf(now - 864e5);
        var out = '';
        var open = null;
        done.forEach(function (x) {
            var day = dayOf(x.at);
            if (day !== open) {
                var d = new Date(x.at);
                var head = day === today ? t('done.today') + '<span>' + t('done.upTo', { t: hm(now) }) + '</span>'
                    : day === yday ? t('done.yesterday') : (d.getMonth() + 1) + '/' + d.getDate();
                out += (open === null ? '' : '</div>') + '<div class="grp-h">' + ic('calclock') + head + '</div><div class="grp">';
                open = day;
            }
            out += doneRow(x);
        });
        return '<div class="body" data-block="tab-done">' + out + '</div></div>';
    }

    function pairHtml(ui) {
        var u = ui || {};
        var typed = u.manual || !u.camera;
        return '<div class="solo" data-block="pair-scan"><span class="lock">' + GLYPH + 'fankeel</span>'
            + (typed ? '' : '<div class="vf" role="img" aria-label="' + t('pair.frame') + '"><i></i><i></i><i></i><i></i><span class="scan"></span></div>')
            + '<h2>' + t('pair.title') + '</h2><p class="one path">' + t('pair.where') + '</p>'
            + (u.say ? '<p class="say" role="status">' + esc(u.say) + '</p>' : '')
            + '<span class="sp"></span>'
            + (typed
                ? '<form class="acts" data-pair-form="1"><input class="code" name="code" autocapitalize="characters" autocomplete="one-time-code" maxlength="8" placeholder="'
                    + t('pair.code') + '" aria-label="' + t('pair.code') + '"><button type="submit" class="cta">' + t('pair.go') + '</button></form>'
                : '<div class="acts"><button type="button" class="ghost" data-act="manual">' + ic('kbd', 'g24') + t('pair.type') + '</button></div>')
            + '</div>';
    }

    function offHtml(host) {
        return '<div class="solo" data-block="pair-error"><span class="off">' + ic('wifioff', 'g24') + '</span>'
            + '<h2>' + t('off.title', { host: esc(host || t('host.station')) }) + '</h2><p class="one">' + t('off.hint') + '</p>'
            + '<span class="tsx"><i class="dot"></i>' + t('off.badge') + '</span><span class="sp"></span>'
            + '<div class="acts"><button type="button" class="cta" data-act="retry">' + ic('refresh', 'g24') + t('off.retry') + '</button>'
            + '<button type="button" class="ghost" data-act="repair">' + t('off.repair') + '</button></div></div>';
    }

    // What #app holds: pair-scan, pair-error, one of the three tabs with the tab bar under it
    // (and the 測站 sheet over it), or one session's screen drawn from its phone.json `P`.
    function screen(M, R, now, ui, P) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        if (r.view === 'chat') return chatHtml(m, r.id, at, u, P, r.pane || 'talk');
        var sheet = u.sheet ? sheetHtml(m, at, u) : '';
        if (r.view === 'done') return doneScreen(m, at, u) + sheet;
        if (r.view === 'ask') return askHtml(m, at, u) + sheet;
        return homeHtml(m, at, u) + sheet;
    }

    // Voice fills the field and never sends; in a gate card it ticks 自己寫 first.
    function listen(win, btn, boxId, said, ended) {
        var SR = win.SpeechRecognition || win.webkitSpeechRecognition;
        var box = win.document.getElementById(boxId);
        if (!SR || !box) return null;
        var opt = btn.closest && btn.closest('.opt');
        var other = opt ? opt.querySelector('input[value="__other"]') : null;
        if (other) other.checked = true;
        var base = box.value ? box.value.replace(/\s*$/, ' ') : '';
        var failed = false;
        var rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        said(t('mic.on'));
        rec.onresult = function (e) {
            var fin = '';
            var mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
            // The page's own input listener keeps the draft and the send button.
            if (win.Event) box.dispatchEvent(new win.Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
            failed = true;
            said(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('mic.denied') : t('mic.missed'));
        };
        rec.onend = function () {
            btn.classList.remove('on');
            box.classList.remove('interim');
            if (!failed) said(box.value.trim() ? t('mic.done') : '');
            ended();
        };
        rec.start();
        return rec;
    }

    function pickLang(win) {
        var saved = null;
        try { saved = win.localStorage.getItem('station.lang'); } catch (e) { saved = null; }
        if (saved === 'zh' || saved === 'en') return saved;
        return /^zh/i.test(String((win.navigator && win.navigator.language) || '')) ? 'zh' : 'en';
    }

    // What the desktop card lists the phone as: the model Android names, or
    // the platform when Chrome's reduced user agent says only `K`.
    function deviceName(ua) {
        var s = String(ua || '');
        var m = /Android[^;)]*;\s*([^;)]+)/.exec(s);
        if (m && m[1].trim() !== 'K' && m[1].trim() !== 'wv') return m[1].trim().slice(0, 40);
        m = /iPhone|iPad|Android/.exec(s);
        return m ? m[0] : 'phone';
    }

    // A session's phone.json less its read time, so an unchanged one compares equal.
    function sameKey(p) { return JSON.stringify(Object.assign({}, p, { at: 0 })); }

    function boot(win) {
        var d = win.document;
        var app = d.getElementById('app');
        setLang(pickLang(win));
        if (d.documentElement) d.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
        if (d.body && d.body.insertAdjacentHTML) d.body.insertAdjacentHTML('afterbegin', SPRITE);
        var camera = Boolean(win.BarcodeDetector && win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.getUserMedia);
        // The app's own ui lives across pair-error and back, so a draft survives a lost station.
        var APP = { mode: 'app', mic: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition), draft: '', open: {}, note: '', sheet: false, photos: [], over: false, lim: false };
        var st = { M: null, P: null, ui: APP, loading: false, chatLoading: false, tried: null, stream: null, rec: null, gone: null };
        function store(k, v) {
            try {
                if (v === undefined) return win.localStorage.getItem(k);
                win.localStorage.setItem(k, v);
            } catch (e) { /* private mode: nothing kept */ }
            return null;
        }
        function route() { return parseRoute(win.location.hash); }
        function post(url, fields) {
            return win.fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new win.URLSearchParams(fields).toString() });
        }
        function upUrl(file, p) {
            var ext = (String(file.type || '').split('/')[1] || 'png').replace(/[^a-z0-9]/g, '');
            return '/phone/upload?root=' + encodeURIComponent(p.root) + '&id=' + encodeURIComponent(p.id) + '&ext=' + encodeURIComponent(ext);
        }
        function refused(code, text) {
            var bad = new Error(t('gate.refused', { code: code, why: String(text || '').trim() }));
            bad.refused = true;
            return bad;
        }
        // A photo goes up raw, not through post(): the station answers the saved file's path.
        function upload(file, p) {
            return win.fetch(upUrl(file, p), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': file.type }, body: file })
                .then(function (r) { return r.text().then(function (text) { if (!r.ok) throw refused(r.status, text); return String(text).trim(); }); });
        }
        // The same with its progress, 0 to 1, where XMLHttpRequest can report it.
        function push(blob, p, prog) {
            if (!win.XMLHttpRequest) return upload(blob, p);
            return new Promise(function (ok, no) {
                var x = new win.XMLHttpRequest();
                x.open('POST', upUrl(blob, p));
                x.setRequestHeader('content-type', blob.type);
                x.upload.onprogress = function (e) { if (e.lengthComputable && e.total) prog(e.loaded / e.total); };
                x.onload = function () {
                    var text = String(x.responseText || '').trim();
                    if (x.status >= 200 && x.status < 300) ok(text); else no(refused(x.status, text));
                };
                x.onerror = function () { no(new Error('network')); };
                x.send(blob);
            });
        }
        var seq = 0;
        // Only #ph-box, the send button and the hint: the field keeps its focus, its text and its mic.
        function strip() {
            var box = d.getElementById('ph-box');
            if (box) box.innerHTML = photosHtml(st.ui);
            var p = current();
            var send = d.querySelector ? d.querySelector('#composer .send') : null;
            if (send && p) send.disabled = !canSend(p, st.ui);
            var line = d.querySelector ? d.querySelector('#composer .cmp-hint') : null;
            if (line && p && !st.rec) line.innerHTML = hintOf(p, st.ui);
        }
        function drop(key) {
            st.ui.photos = st.ui.photos.filter(function (x) {
                if (x.key !== key) return true;
                if (x.url && win.URL && win.URL.revokeObjectURL) win.URL.revokeObjectURL(x.url);
                return false;
            });
        }
        // Up to PH_MAX in the strip; past that the rest are named in the hint, not added.
        function pick(files, p, input) {
            var room = PH_MAX - st.ui.photos.length;
            st.ui.over = files.length > room;
            files.slice(0, Math.max(0, room)).forEach(function (file) {
                var x = { key: 'ph' + (++seq), url: win.URL && win.URL.createObjectURL ? win.URL.createObjectURL(file) : '', pct: 0, path: null };
                st.ui.photos.push(x);
                shrink(win, file).then(function (blob) {
                    return push(blob, p, function (f) { x.pct = Math.min(99, Math.round(f * 100)); strip(); });
                }).then(function (where) {
                    x.path = where;
                    x.pct = 100;
                    strip();
                }).catch(function (err) {
                    drop(x.key);
                    st.ui.note = err && err.refused ? err.message : t('gate.failed');
                    draw();
                });
            });
            if (input) input.value = '';
            strip();
        }
        function rethrow(e) { win.setTimeout(function () { throw e; }); }
        function pairUi(extra) {
            var u = { mode: 'pair', camera: camera, manual: !camera, say: '' };
            for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) u[k] = extra[k];
            return u;
        }
        function offline() { st.ui = { mode: 'off', host: store('station.m.host') }; draw(); }
        function stopScan() {
            if (!st.stream) return;
            st.stream.getTracks().forEach(function (k) { k.stop(); });
            st.stream = null;
        }
        // The camera in .vf, read by BarcodeDetector every 300 ms until a
        // pairing url turns up; refused or absent, the typed code instead.
        function scan() {
            var vf = d.querySelector ? d.querySelector('.vf') : null;
            if (!vf || st.stream || !st.ui.camera || st.ui.manual) return;
            win.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
                st.stream = stream;
                var v = d.createElement('video');
                v.setAttribute('playsinline', '');
                v.muted = true;
                v.srcObject = stream;
                vf.insertBefore(v, vf.firstChild);
                v.play();
                var det = new win.BarcodeDetector({ formats: ['qr_code'] });
                (function tick() {
                    if (!st.stream) return;
                    det.detect(v).then(function (codes) {
                        var hit = null;
                        (codes || []).forEach(function (c) { hit = hit || codeIn(c.rawValue); });
                        if (hit) { stopScan(); pairWith(hit); } else win.setTimeout(tick, 300);
                    }, function () { win.setTimeout(tick, 300); });
                }());
            }, function () { st.ui = pairUi({ camera: false, manual: true }); draw(); });
        }
        // The session the chat route names: its phone.json, else its mobile.json row.
        function current() {
            var id = route().id;
            if (st.P && st.P.id === id) return st.P;
            return ((st.M && st.M.tasks) || []).concat((st.M && st.M.stopped) || []).filter(function (x) { return x.id === id; })[0] || null;
        }
        function cv() { return d.querySelector ? d.querySelector('.cv') : null; }
        function toEnd() { var c = cv(); if (c) c.scrollTop = c.scrollHeight; }
        // The question being asked, so a new gate in the same session does not open already expanded.
        function gateKey(p) {
            var g = p && p.state === 'gate' ? p.gate || ((st.M && st.M.gates) || []).filter(function (x) { return x.id === p.id; })[0] : null;
            var q = g && (g.questions || [])[0];
            return q ? g.until + '|' + q.question : '';
        }
        // The report rows the user opened, put back after .cv is written again.
        function keepOpen(c) {
            var opened = {};
            Array.prototype.forEach.call(c.querySelectorAll ? c.querySelectorAll('details[open]') : [], function (x) { opened[x.getAttribute('data-k')] = 1; });
            return function (to) {
                Array.prototype.forEach.call(to && to.querySelectorAll ? to.querySelectorAll('details') : [], function (x) { if (opened[x.getAttribute('data-k')]) x.setAttribute('open', ''); });
            };
        }
        function draw() {
            stopScan();
            if (st.rec) st.rec.stop();
            var R = route(), c = cv();
            // Rows are kept only while the same session stays on screen.
            var keep = c && R.view === 'chat' && st.shown === R.id ? keepOpen(c) : null;
            var gk = gateKey(R.view === 'chat' ? current() : null);
            if (gk !== st.gk) { st.ui.pin = false; st.gk = gk; }
            app.innerHTML = screen(st.M, R, Date.now(), st.ui, R.view === 'chat' && st.P && st.P.id === R.id ? st.P : null);
            st.shown = R.view === 'chat' ? R.id : null;
            if (keep) keep(cv());
            if (st.ui.mode === 'pair') scan();
            if (R.view === 'chat' && R.pane === 'talk') toEnd();
        }
        // The pane's own contents and the TokenBar, never the composer: what is typed, picked or said stays.
        function pv() { return d.querySelector ? d.querySelector('.cv') || d.querySelector('.ov') : null; }
        function patch() {
            var c = pv();
            if (!c) return draw();
            var R = route();
            var at = Date.now();
            var talk = !R.pane || R.pane === 'talk';
            var end = c.scrollHeight - c.scrollTop - c.clientHeight < 48;
            var keep = keepOpen(c);
            c.innerHTML = talk ? cvInner(st.P, at, st.ui) : paneInner(st.P, R.pane, at, st.ui, st.M);
            keep(c);
            var tk = d.querySelector('.tkb');
            if (tk) tk.innerHTML = tokenInner(st.P, at, st.ui);
            if (end && talk) toEnd();
        }
        // A gate card is never redrawn while its gate stands, so what is
        // picked, typed or said stays; a new reply patches only .cv while the
        // state, the attach and the queued message are the same.
        function refresh(before, P) {
            st.P = P;
            if (!before || before.id !== P.id) return draw();
            if (sameKey(before) === sameKey(P)) return;
            if (gateKey(before) !== gateKey(P)) return draw();
            if (before.state === 'gate' && P.state === 'gate' && before.gate && P.gate && before.gate.until === P.gate.until) return;
            if (before.state === P.state && before.attached === P.attached && JSON.stringify(before.waiting) === JSON.stringify(P.waiting)) return patch();
            draw();
        }
        function pairWith(code) {
            st.ui = pairUi({ manual: true, say: t('pair.busy') });
            draw();
            post('/station/remote/pair', { code: code, name: deviceName(win.navigator && win.navigator.userAgent) }).then(function (r) {
                if (r.status === 201) {
                    st.ui = APP;
                    win.location.hash = '#/';
                    return load();
                }
                return r.text().then(function (text) { st.ui = pairUi({ manual: true, say: t('pair.refused', { code: r.status, why: String(text || '').trim() }) }); draw(); });
            }, function () { st.ui = pairUi({ manual: true, say: t('pair.failed') }); draw(); });
        }
        // 401 is an unpaired phone; anything else that is not a 2xx, or no
        // whole reply at all, is a station this phone cannot reach. Only the
        // request is judged so: a drawing error is a bug, thrown where the
        // console shows it, never a pair-error screen.
        var UNPAIRED = {};
        var GONE = {};
        function load() {
            st.loading = true;
            return win.fetch('/station/mobile.json', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
                if (r.status === 401) return UNPAIRED;
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then(function (M) {
                st.loading = false;
                if (M === UNPAIRED) {
                    var R = route();
                    if (R.pair && st.tried !== R.pair) { st.tried = R.pair; return pairWith(R.pair); }
                    st.ui = pairUi({});
                    return draw();
                }
                st.M = M;
                st.ui = APP;
                if (M && M.host) store('station.m.host', String(M.host));
                if (route().view === 'chat') return loadChat();
                draw();
            }, function () {
                st.loading = false;
                offline();
            }).then(null, rethrow);
        }
        function loadChat() {
            var id = route().id;
            if (!id) return null;
            st.chatLoading = true;
            return win.fetch('/station/phone.json?id=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
                if (r.status === 401) return UNPAIRED;
                if (r.status === 404) return GONE;
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then(function (P) {
                st.chatLoading = false;
                if (P === UNPAIRED) { st.ui = pairUi({}); return draw(); }
                if (st.ui.mode !== 'app' || route().id !== id) return null;
                // Gone is drawn once: a redraw every read would take the composer's focus.
                if (P === GONE) {
                    if (st.gone === id) return null;
                    st.gone = id;
                    st.P = null;
                    return draw();
                }
                st.gone = null;
                return refresh(st.P && st.P.id === id ? st.P : null, P);
            }, function () {
                st.chatLoading = false;
                offline();
            }).then(null, rethrow);
        }
        // A refusal or a lost station says so under the conversation; the draft stays.
        function act(url, fields, done) {
            st.ui.note = '';
            return post(url, fields).then(function (r) {
                if (r.ok) { if (done) done(); return route().view === 'chat' ? loadChat() : load(); }
                return r.text().then(function (text) { st.ui.note = t('gate.refused', { code: r.status, why: String(text || '').trim() }); draw(); });
            }, function () { st.ui.note = t('gate.failed'); draw(); });
        }
        // phone.json first: a conversation never reads mobile.json again, so
        // its gates still hold the gate before this one for the same session.
        function gateOf(id) {
            var p = st.P && st.P.id === id && st.P.gate ? st.P : null;
            if (p) return { id: p.id, root: p.root, questions: p.gate.questions };
            return ((st.M && st.M.gates) || []).filter(function (x) { return x.id === id; })[0] || null;
        }
        // 送出答案: a refusal or a network error changes the card's one line
        // and nothing else, so what was picked stays picked.
        function answer(f) {
            var say = f.querySelector('.gc-st');
            var g = gateOf(f.getAttribute('data-id'));
            if (!g) { say.textContent = t('gate.gone'); return; }
            var got = collect(f.querySelectorAll('input,textarea'), (g.questions || []).length);
            var answers = answersOf(g.questions, got.picks, got.others);
            if (!answers) { say.textContent = t('gate.needAll'); return; }
            var btn = f.querySelector('.cta');
            btn.disabled = true;
            say.textContent = t('gate.sending');
            post('/answer', { root: g.root, id: g.id, answers: JSON.stringify(answers) }).then(function (r) {
                if (r.status === 201) { say.textContent = t('gate.sent'); return loadChat(); }
                return r.text().then(function (text) { btn.disabled = false; say.textContent = t('gate.refused', { code: r.status, why: String(text || '').trim() }); });
            }, function () { btn.disabled = false; say.textContent = t('gate.failed'); });
        }
        // The text, then one [圖片] line per photo; nothing goes while a photo is still uploading.
        function say(f) {
            var p = current();
            var box = f.querySelector('textarea');
            var text = String((box && box.value) || '').trim();
            var list = st.ui.photos || [];
            if (!p || (!text && !list.length) || pending(st.ui) >= 0) return;
            var body = [text].concat(list.map(function (x) { return '[圖片] ' + x.path; })).filter(Boolean).join('\n');
            st.ui.draft = text;
            act('/phone/say', { root: p.root, id: p.id, text: body }, function () {
                st.ui.draft = '';
                list.forEach(function (x) { drop(x.key); });
                st.ui.over = false;
                st.P = null;
            });
        }
        d.addEventListener('submit', function (e) {
            var f = e.target;
            if (!f || !f.getAttribute) return;
            if (f.id === 'gate-card') { e.preventDefault(); answer(f); return; }
            if (f.id === 'composer') { e.preventDefault(); say(f); return; }
            if (f.getAttribute('data-pair-form') !== null) {
                e.preventDefault();
                var input = f.querySelector('input');
                var code = codeIn(input ? input.value : '');
                if (code) pairWith(code);
                else { st.ui = pairUi({ manual: true, say: t('pair.bad') }); draw(); }
            }
        });
        function pinToggle(el) {
            st.ui.pin = !st.ui.pin;
            var pin = el.closest('.gpin');
            if (pin && pin.classList) pin.classList.toggle('open', st.ui.pin);
            el.setAttribute('aria-expanded', st.ui.pin ? 'true' : 'false');
        }
        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && st.ui.sheet) { st.ui.sheet = false; draw(); return; }
            var el = e.target && e.target.closest ? e.target.closest('[data-act=gpin]') : null;
            if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            pinToggle(el);
        });
        d.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-act],[data-mic]') : null;
            if (!el) return;
            var mic = el.getAttribute('data-mic');
            if (mic) {
                if (st.rec) { st.rec.stop(); return; }
                var wrap = (el.closest && (el.closest('fieldset') || el.closest('form'))) || null;
                var line = wrap ? wrap.querySelector('[data-say]') : null;
                st.rec = listen(win, el, mic, function (text) { if (line) line.textContent = text; }, function () { st.rec = null; });
                return;
            }
            var what = el.getAttribute('data-act');
            var p = current();
            if (what === 'manual') { st.ui = pairUi({ manual: true }); draw(); }
            else if (what === 'retry') load();
            else if (what === 'repair') { st.ui = pairUi({}); draw(); }
            else if (what === 'attach' && p) act('/phone/attach', { root: p.root, id: p.id });
            else if (what === 'detach') {
                var did = el.getAttribute('data-id');
                var dp = did ? ((st.M && st.M.tasks) || []).filter(function (x) { return x.id === did; })[0] : p;
                if (dp) act('/phone/detach', { root: dp.root, id: dp.id }, function () { st.ui.sheet = false; });
            } else if (what === 'sheet') {
                st.ui.sheet = !st.ui.sheet;
                draw();
            } else if (what === 'fold') {
                var fk = el.getAttribute('data-key');
                st.ui.open[fk] = !st.ui.open[fk];
                // The TokenBar opens in place: a full draw would build the composer again.
                var tkb = fk === 'tk' && d.querySelector ? d.querySelector('.tkb') : null;
                var tp = tkb ? current() : null;
                if (tkb && tp) { tkb.innerHTML = tokenInner(tp, Date.now(), st.ui); return; }
                if (el.closest && el.closest('.cv,.ov') && st.P) patch(); else draw();
            } else if (what === 'ph-x') {
                drop(el.getAttribute('data-key'));
                st.ui.over = false;
                strip();
            } else if (what === 'ph-add') {
                var inp = d.getElementById('cmp-file');
                if (inp && inp.click) inp.click();
            } else if (what === 'lim') {
                if (e.preventDefault) e.preventDefault();
                st.ui.lim = !st.ui.lim;
                strip();
            } else if (what === 'steps') {
                var key = el.getAttribute('data-key');
                st.ui.open[key] = !st.ui.open[key];
                if (st.P) patch(); else draw();
            } else if (what === 'more') {
                st.ui.rep = !st.ui.rep;
                if (st.P) patch(); else draw();
            } else if (what === 'gpin') {
                pinToggle(el);
            } else if (what === 'gate') {
                var gcard = d.getElementById('gate-card');
                if (gcard && gcard.scrollIntoView) gcard.scrollIntoView({ block: 'start' });
            }
        });
        function grow(el) {
            if (!el.style) return;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
        // Typing in a 自己寫 box ticks its own radio or checkbox; the
        // composer's text is the draft a redraw puts back.
        function typed(e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            if (el.id === 'cmp-box') {
                st.ui.draft = el.value;
                var send = d.querySelector ? d.querySelector('#composer .send') : null;
                var cp = current();
                if (send) send.disabled = !cp || !canSend(cp, st.ui);
                grow(el);
                return;
            }
            if (el.getAttribute('data-own') === null) return;
            var box = el.closest ? el.closest('label') : null;
            var pick = box ? box.querySelector('input[value="__other"]') : null;
            if (pick) pick.checked = true;
            if (e.type === 'input') grow(el);
        }
        d.addEventListener('change', function (e) {
            var el = e.target;
            var p = current();
            if (!el || !el.files || !el.files.length || !p) return;
            if (el.id === 'cmp-file') return pick(Array.prototype.slice.call(el.files), p, el);
            // A gate question's own photo: one, its path into that question's box.
            if (!el.getAttribute || el.getAttribute('data-pic') === null) return;
            var box = (el.closest('fieldset') || el.closest('form')).querySelector('.own');
            if (!box) return;
            shrink(win, el.files[0]).then(function (b) { return upload(b, p); }).then(function (where) {
                box.value += (box.value ? '\n' : '') + '[圖片] ' + where;
                typed({ target: box, type: 'input' });
            }).catch(function (err) { st.ui.note = err && err.refused ? err.message : t('gate.failed'); draw(); });
        });
        d.addEventListener('input', typed);
        d.addEventListener('focusin', typed);
        function poll(view) {
            if (d.visibilityState !== 'visible' || st.ui.mode !== 'app') return;
            var chat = route().view === 'chat';
            if (view === 'chat' && chat && !st.chatLoading) loadChat();
            else if (view === 'home' && !chat && !st.loading) load();
        }
        d.addEventListener('visibilitychange', function () {
            if (d.visibilityState !== 'visible' || st.ui.mode !== 'app') return;
            if (route().view === 'chat') loadChat(); else load();
        });
        win.addEventListener('hashchange', function () {
            st.ui.note = '';
            st.ui.rep = false;
            st.ui.pin = false;
            st.ui.sheet = false;
            draw();
            if (st.ui.mode !== 'app') return;
            // The list drawn before a conversation is stale by now: read it again.
            if (route().view === 'chat') loadChat(); else load();
        });
        // A sideways swipe on a pane moves to the pane beside it (the mockup's scroll-snap, note 6).
        var touch = null;
        d.addEventListener('touchstart', function (e) {
            var p0 = e.touches && e.touches[0];
            touch = p0 && e.target && e.target.closest && e.target.closest('.cv,.ov') ? { x: p0.clientX, y: p0.clientY } : null;
        }, { passive: true });
        d.addEventListener('touchend', function (e) {
            var p1 = e.changedTouches && e.changedTouches[0];
            var R = route();
            if (!touch || !p1 || R.view !== 'chat') { touch = null; return; }
            var to = swipeTo(R.pane, p1.clientX - touch.x, p1.clientY - touch.y);
            touch = null;
            if (to) win.location.hash = '#/s/' + R.id + '/' + to;
        }, { passive: true });
        win.setInterval(function () { poll('home'); }, POLL_MS);
        win.setInterval(function () { poll('chat'); }, CHAT_MS);
        if (win.navigator && win.navigator.serviceWorker) win.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* the page works without it */ });
        load();
    }

    var api = {
        parseRoute: parseRoute, screen: screen, answersOf: answersOf, collect: collect, codeIn: codeIn, setLang: setLang, STR: STR,
        turnsOf: turnsOf, stepsLine: stepsLine, dur: dur, SCREEN: SCREEN, swipeTo: swipeTo, PANES: PANES,
        shrink: shrink, fitEdge: fitEdge,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_M = api;
    if (w && w.document && w.document.getElementById && w.document.getElementById('app')) boot(w);
}(typeof window !== 'undefined' ? window : null));
