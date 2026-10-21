'use strict';
// ntfy notifications (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// one JSON publish to `<notify.server>/` per trigger — a gate waiting
// (hooks/gate.js), a stage finished (`task.js stage`), a task ended
// (hooks/leave.js) — sent by a detached child, scripts/notify.js, so no hook
// waits on the network and no failure reaches a hook's output or exit code.
// What leaves this machine is the stage, the first question, the task cut to
// 80 characters, the project and the cost: each event is built from those
// fields alone, never from the whole entry. Off under `node --test` unless
// FANKEEL_NOTIFY_TEST=1, so no suite run publishes anything.
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { readServeRecord } = require('./serve.js');

// Started by path, as lib/serve.js starts scripts/station.js; never required.
const CHILD = path.join(__dirname, '..', 'scripts', 'notify.js');
const KINDS = new Set(['gate', 'stage', 'end']);

function newTopic() {
    return 'fankeel-' + crypto.randomBytes(10).toString('hex');
}

// The tailnet address scripts/station.js records beside the loopback one while
// remote is on: a notification's tap opens the phone page there.
function remoteBase(configDir) {
    const rec = readServeRecord(configDir);
    const url = rec && rec.remote && rec.remote.url;
    return typeof url === 'string' && /^https:\/\/[^/\s]+\/$/.test(url) ? url : null;
}

// Whitespace collapsed; past `n` characters, n - 1 of them and an ellipsis.
function cut(s, n) {
    const text = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

// The entry's own project, else the registry root's folder name.
function projectOf(mine, root) {
    const own = mine && typeof mine.project === 'string' ? mine.project.trim() : '';
    return own || String(root || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

const taskOf = (mine) => (mine && typeof mine.task === 'string' ? mine.task : '');
const stageOf = (mine) => (mine && typeof mine.stage === 'string' ? mine.stage : '');

function gateEvent(mine, questions, id, root) {
    const first = Array.isArray(questions) && questions[0] && typeof questions[0].question === 'string' ? questions[0].question : '';
    return {
        kind: 'gate', id: String(id || ''), tab: 'gate',
        title: [stageOf(mine), 'gate 在等你'].filter(Boolean).join(' '),
        message: [cut(first, 80), cut(taskOf(mine), 80)].filter(Boolean).join(' — '),
    };
}

function stageEvent(mine, from, to, id, root) {
    return {
        kind: 'stage', id: String(id || ''), tab: 'task',
        title: from + ' 完成，接著 ' + to,
        message: [cut(taskOf(mine), 80), projectOf(mine, root)].filter(Boolean).join(' · '),
    };
}

// `usd` is the parent's and its agents' cost together, or null when neither
// side was priced; the stage count is the stages the entry's clock holds.
function endEvent(mine, usd, id, root) {
    const clock = mine && mine.clock && typeof mine.clock === 'object' && !Array.isArray(mine.clock) ? mine.clock : {};
    const parts = [projectOf(mine, root), Object.keys(clock).length + ' 個 stage'];
    if (typeof usd === 'number' && Number.isFinite(usd)) parts.push('$' + usd.toFixed(2));
    return { kind: 'end', id: String(id || ''), tab: 'task', title: '任務結束：' + cut(taskOf(mine), 40), message: parts.filter(Boolean).join(' · ') };
}

// The publish, or null: the trigger has to be the boolean true the profile
// reads back, and a topic and a server have to be there. A gate is priority 4
// with a 打開 gate action; a stage and an end are 2, silent. The tap opens
// `<base>m#/gate/<id>` or `m#/task/<id>` when the station has a tailnet address.
function request(values, event, base) {
    const v = values || {};
    if (!event || !KINDS.has(event.kind) || v['notify.' + event.kind] !== true) return null;
    const topic = v['notify.topic'];
    const server = v['notify.server'];
    if (typeof topic !== 'string' || !topic || typeof server !== 'string' || !/^https?:\/\//.test(server)) return null;
    const body = { topic, title: event.title, message: event.message, priority: event.kind === 'gate' ? 4 : 2, tags: ['fankeel'] };
    if (typeof base === 'string' && base && event.id) {
        body.click = base + 'm#/' + event.tab + '/' + encodeURIComponent(event.id);
        if (event.kind === 'gate') body.actions = [{ action: 'view', label: '打開 gate', url: body.click }];
    }
    return { url: server.replace(/\/+$/, '') + '/', body };
}

// One POST, aborted after `ms`; true on a 2xx, false on anything else.
async function send(req, ms) {
    if (!req || typeof req.url !== 'string' || !req.body) return false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 8000);
    try {
        const res = await fetch(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body), signal: ctl.signal });
        await res.text().catch(() => '');
        return res.ok;
    } catch (e) {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// Hands the publish to a detached child and returns at once; true when one
// was started. Never throws: a hook calls this inside its own try, and a
// notification is never worth a hook's exit code.
function fire(values, event, opts) {
    try {
        const o = opts || {};
        const env = o.env || process.env;
        if (env.NODE_TEST_CONTEXT && env.FANKEEL_NOTIFY_TEST !== '1') return false;
        const base = o.base !== undefined ? o.base : remoteBase(o.configDir);
        const req = request(values, event, base);
        if (!req) return false;
        const child = spawn(process.execPath, [CHILD, JSON.stringify(req)], { detached: true, stdio: 'ignore', windowsHide: true, env });
        child.on('error', () => { /* a spawn that failed; nothing waits on it */ });
        child.unref();
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { newTopic, remoteBase, gateEvent, stageEvent, endEvent, request, send, fire };
