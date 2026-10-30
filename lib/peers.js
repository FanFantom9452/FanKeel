'use strict';
// The other computers the phone's station reads for it (docs/99-archive/2026-10-29-mobile-sources-design.md §2;
// docs/03-decisions/2026-10-29-mobile-sources.md). This station pairs with another one exactly
// the way a phone does — the 8-character code on that computer's 手機遠端 card, redeemed at
// its own POST /station/remote/pair — and keeps the device token it is given in
// `<configDir>/fankeel/peers.json`, never in a repository. The token is this station's own:
// the phone's fk_device cookie is host-only and never leaves the phone.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');
const remote = require('./remote.js');

const TIMEOUT_MS = 3000;
// The phone reads mobile.json every 5 s; one round of reads at most that often.
const ROUND_MS = 5e3;
// `seen` and the last answer go to disk at most once a minute.
const SAVE_MS = 60e3;
const DNS = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'peers.json');
const nameOf = (dnsName) => String(dnsName).split('.')[0];

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    return Array.isArray(d.peers)
        ? d.peers.filter((p) => p && typeof p.dnsName === 'string' && DNS.test(p.dnsName) && typeof p.token === 'string' && p.token)
        : [];
}

function save(configDir, list) {
    const file = storePath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, JSON.stringify({ peers: list }, null, 2) + '\n');
}

// One HTTPS request through the tailnet; `tailscale serve` on the other side holds a real
// certificate, so nothing is relaxed. Node sets Host from `hostname`.
function request(o) {
    return new Promise((resolve, reject) => {
        const u = new URL(o.url);
        const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: o.method || 'GET', headers: o.headers || {}, timeout: TIMEOUT_MS }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('timed out after ' + TIMEOUT_MS + ' ms')));
        req.on('error', reject);
        if (o.body) req.write(o.body);
        req.end();
    });
}

// Redeem `code` at `dnsName`'s pairing route as this station, named `電腦 <self>` on that
// computer's 手機遠端 card, where it can be removed like any phone.
async function pairWith(configDir, dnsName, code, self, send, now) {
    const dns = String(dnsName || '').trim().toLowerCase();
    if (!DNS.test(dns)) return { ok: false, reason: 'not a tailnet name: ' + dns };
    const body = Buffer.from(new URLSearchParams({ code: String(code || ''), name: '電腦 ' + String(self || '') }).toString());
    let r;
    try {
        r = await (send || request)({
            method: 'POST', url: 'https://' + dns + '/station/remote/pair', body,
            headers: { origin: 'https://' + dns, 'content-type': 'application/x-www-form-urlencoded', 'content-length': body.length },
        });
    } catch (e) {
        return { ok: false, reason: 'cannot reach ' + dns + ': ' + ((e && e.message) || e) };
    }
    if (r.status !== 201) return { ok: false, status: r.status, reason: String(r.body || '').trim() || 'refused with ' + r.status };
    const token = remote.tokenOf([].concat((r.headers && r.headers['set-cookie']) || []).join('; '));
    if (!token) return { ok: false, reason: dns + ' answered 201 with no device token' };
    const list = load(configDir).filter((p) => p.dnsName !== dns);
    list.push({ dnsName: dns, name: nameOf(dns), token, paired: now, seen: null, last: null });
    save(configDir, list);
    return { ok: true, name: nameOf(dns) };
}

// The cache the mobile.json route reads, never awaited by a request. A paired computer
// answering 200 to GET /station/mobile.json?own=1 with this station's token is 'on'; refused
// (401: unpaired there, `refused`), not 200, unparsable or silent is 'off' with the rows and
// time of its last answer kept; not asked yet is 'wait'. `probed` is lib/tailscale.js
// probeStations()'s list: one with no token here is 'unpaired'.
function poller(configDir, send) {
    const state = new Map();
    for (const p of load(configDir)) state.set(p.dnsName, { state: p.last ? 'off' : 'wait', seen: Number.isFinite(p.seen) ? p.seen : null, body: p.last || null, refused: false });
    let at = 0;
    let busy = false;
    let saved = Date.now();
    // A re-pair bumps `gen`: an answer to a read sent with the old token is dropped.
    let gen = 0;
    async function one(p) {
        const g = gen;
        const was = state.get(p.dnsName) || { state: 'wait', seen: null, body: null, refused: false };
        let r = null;
        let why = '';
        try {
            r = await (send || request)({ method: 'GET', url: 'https://' + p.dnsName + '/station/mobile.json?own=1', headers: { cookie: 'fk_device=' + p.token } });
        } catch (e) {
            why = 'no answer: ' + ((e && e.message) || e);
        }
        if (g !== gen) return;
        let body = null;
        if (!why && r.status !== 200) why = 'answered ' + r.status;
        if (!why) {
            try { body = JSON.parse(String(r.body)); } catch (e) { why = 'answered 200 with no JSON: ' + e.message; }
        }
        if (!why) {
            state.set(p.dnsName, { state: 'on', seen: Date.now(), body, refused: false });
            return;
        }
        // One line per change of reason, so a garbage 200 is not mistaken for a dropped connection.
        if (why !== was.why) process.stderr.write('station: ' + p.dnsName + ' is off — ' + why + '\n');
        state.set(p.dnsName, Object.assign({}, was, { state: 'off', refused: !!r && r.status === 401, why }));
    }
    function persist() {
        const list = load(configDir).map((p) => {
            const s = state.get(p.dnsName);
            return s && s.state === 'on' ? Object.assign({}, p, { seen: s.seen, last: s.body }) : p;
        });
        if (list.length) save(configDir, list);
    }
    function round(now) {
        if (busy || now - at < ROUND_MS) return;
        const list = load(configDir);
        if (!list.length) return;
        busy = true;
        at = now;
        Promise.all(list.map(one)).then(() => {
            if (Date.now() - saved >= SAVE_MS) {
                saved = Date.now();
                persist();
            }
        }).catch((e) => { process.stderr.write('station: other computers not read — ' + ((e && e.message) || e) + '\n'); })
            .then(() => { busy = false; });
    }
    function hostOf(url) {
        try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
    }
    function machines(probed, now) {
        round(now);
        const paired = load(configDir);
        const out = paired.map((p) => {
            const s = state.get(p.dnsName) || { state: 'wait', seen: null, body: null, refused: false };
            return { name: p.name, dnsName: p.dnsName, url: 'https://' + p.dnsName + '/m', state: s.state, seen: s.seen, paired: Number.isFinite(p.paired) ? p.paired : null, refused: s.refused, body: s.body };
        });
        const have = new Set(paired.map((p) => p.dnsName));
        for (const o of Array.isArray(probed) ? probed : []) {
            const dns = hostOf(o && o.url);
            if (!dns || have.has(dns)) continue;
            have.add(dns);
            out.push({ name: String(o.name || nameOf(dns)), dnsName: dns, url: o.url, state: 'unpaired', seen: null, paired: null, refused: false, body: null });
        }
        return out;
    }
    // A pairing that just landed is read on the next request rather than up to 5 s later,
    // and that computer's refusal of its old token is forgotten at once.
    function kick(dnsName) {
        at = 0;
        gen++;
        if (dnsName) state.delete(dnsName);
    }
    return { machines, kick };
}

// The phone's own session routes, the only ones passed on to another computer (Task 3).
const FORWARD = {
    GET: new Set(['/station/phone.json', '/station/unreg.json', '/phone/img']),
    POST: new Set(['/answer', '/phone/attach', '/phone/detach', '/phone/say', '/phone/upload']),
};

// A phone's request for a session on computer `name`, sent there with this station's token
// for it — never the phone's cookie. That computer refusing the token answers 502, so the
// phone does not read it as its own pairing gone.
async function forward(configDir, name, method, pathAndQuery, headers, body, send) {
    const plain = (status, text) => ({ status, type: 'text/plain; charset=utf-8', body: text + '\n' });
    const u = new URL(String(pathAndQuery || ''), 'http://x');
    if (!FORWARD[method] || !FORWARD[method].has(u.pathname)) return plain(404, 'not passed on to another computer: ' + method + ' ' + u.pathname);
    const p = load(configDir).find((x) => x.name === name);
    if (!p) return plain(404, 'no paired computer named ' + name);
    const h = { cookie: 'fk_device=' + p.token };
    if (method === 'POST') {
        h.origin = 'https://' + p.dnsName;
        if (headers && headers['content-type']) h['content-type'] = headers['content-type'];
        h['content-length'] = body ? body.length : 0;
    }
    let r;
    try {
        r = await (send || request)({ method, url: 'https://' + p.dnsName + u.pathname + u.search, headers: h, body: method === 'POST' ? body : undefined });
    } catch (e) {
        return plain(502, 'cannot reach ' + name + ': ' + ((e && e.message) || e));
    }
    if (r.status === 401) return plain(502, name + ' refused this station\'s token: pair it again from the 測站 sheet');
    return { status: r.status, type: (r.headers && r.headers['content-type']) || 'text/plain; charset=utf-8', body: r.body };
}

module.exports = { pairWith, poller, forward };
