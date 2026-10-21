'use strict';
// The station reached from a phone (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §1, §3): who a request comes from, what the tailnet may reach, and the
// pairing that turns a one-time code into a device cookie. Pure but for one
// store, `<configDir>/fankeel/remote.json`, which holds each device token's
// SHA-256 and never a token, and lives in the config directory — never in a
// repository.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

const LOOPBACK = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;
// What `tailscale serve`, or any proxy, adds. A loopback Host carrying one of
// these came through a proxy, not from this machine's own browser.
const PROXY = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'tailscale-user-login'];
// No 0/O, 1/I/L: a code read off a screen and typed on a phone.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 8;
const CODE_MS = 10 * 60e3;
const MISSES = 5;
const SEEN_MS = 60e3;
const NAME_MAX = 40;
const COOKIE = 'fk_device';
// Through the tailnet without a cookie: the phone page, its assets, pairing.
const OPEN_GET = new Set(['/', '/m', '/m/manifest.webmanifest', '/m/icon.svg', '/sw.js', '/station/station.css', '/station/mobile.js', '/station/mobile.css']);
// Never through the tailnet: the 手機遠端 card's own routes, the health probe.
const LOCAL = new Set(['/station/remote', '/station/remote/qr.svg', '/station/remote/code', '/station/remote/revoke', '/station/health']);

// A Host as compared: the first of a list, lower-cased, without :443 or a trailing dot.
const nameOf = (h) => String(h || '').split(',')[0].trim().toLowerCase().replace(/:443$/, '').replace(/\.$/, '');

// 'loopback' is today's station; 'tailnet' is a request `tailscale serve`
// passed on — its Host (or X-Forwarded-Host) is this machine's tailnet name,
// or it was rewritten to loopback with a proxy header on it; null is anything
// else, and with `dnsName` null (remote off) that is every Host but loopback's.
function hostKind(headers, dnsName) {
    const h = headers || {};
    const host = String(h.host || '').trim().toLowerCase();
    const proxied = PROXY.some((k) => h[k] !== undefined);
    if (LOOPBACK.test(host) && !proxied) return 'loopback';
    const name = nameOf(dnsName);
    if (!name) return null;
    if (nameOf(host) === name || nameOf(h['x-forwarded-host']) === name) return 'tailnet';
    if (proxied && LOOPBACK.test(host)) return 'tailnet';
    return null;
}

// A POST through the tailnet carries the phone page's own Origin.
function sameOrigin(headers, dnsName) {
    const name = nameOf(dnsName);
    return Boolean(name) && String((headers || {}).origin || '').trim().toLowerCase() === 'https://' + name;
}

function policy(method, pathname) {
    if (method === 'POST' && pathname === '/station/remote/pair') return 'open';
    if (LOCAL.has(pathname) || pathname.startsWith('/chartroom/')) return 'local';
    if (method === 'GET' && OPEN_GET.has(pathname)) return 'open';
    return 'device';
}

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'remote.json');

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    const code = d.code && typeof d.code.value === 'string' && Number.isFinite(d.code.until) ? d.code : null;
    const devices = Array.isArray(d.devices)
        ? d.devices.filter((x) => x && typeof x.id === 'string' && typeof x.hash === 'string' && /^[0-9a-f]{64}$/.test(x.hash))
        : [];
    return { code, devices };
}

function save(configDir, data) {
    const file = storePath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, JSON.stringify(data, null, 2) + '\n');
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function newCode(configDir, now) {
    let value = '';
    for (let i = 0; i < CODE_LEN; i++) value += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    const d = load(configDir);
    d.code = { value, until: now + CODE_MS, misses: 0 };
    save(configDir, d);
    return { value, until: d.code.until };
}

// The code the card shows: the live one, or a new one when none is.
function liveCode(configDir, now) {
    const c = load(configDir).code;
    return c && c.until > now ? { value: c.value, until: c.until } : newCode(configDir, now);
}

function cleanName(name) {
    const s = String(name || '').replace(/[\u0000-\u001f\u007f<>"'&`]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    return s || 'phone';
}

// The code is compared as SHA-256 digests through timingSafeEqual, so a wrong
// guess takes as long as a right one. Five wrong guesses drop the code.
function pair(configDir, code, name, now) {
    const d = load(configDir);
    const c = d.code;
    if (!c || !(c.until > now)) return { ok: false, reason: 'no live pairing code — mint one on the station\'s 手機遠端 card' };
    if (!crypto.timingSafeEqual(sha(String(code || '').trim().toUpperCase()), sha(c.value))) {
        c.misses = (Number(c.misses) || 0) + 1;
        const dropped = c.misses >= MISSES;
        if (dropped) d.code = null;
        save(configDir, d);
        return { ok: false, reason: dropped ? 'five wrong codes: this code is dropped — mint a new one' : 'wrong pairing code' };
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const device = { id: crypto.randomBytes(8).toString('hex'), hash: sha(token).toString('hex'), name: cleanName(name), paired: now, seen: now };
    d.devices.push(device);
    d.code = null;
    save(configDir, d);
    return { ok: true, token, device: { id: device.id, name: device.name } };
}

function deviceFor(configDir, token, now) {
    if (typeof token !== 'string' || !token) return null;
    const want = sha(token);
    const d = load(configDir);
    const hit = d.devices.find((x) => crypto.timingSafeEqual(Buffer.from(x.hash, 'hex'), want));
    if (!hit) return null;
    if (!(now - hit.seen < SEEN_MS)) {
        hit.seen = now;
        save(configDir, d);
    }
    return { id: hit.id, name: hit.name, paired: hit.paired, seen: hit.seen };
}

function revoke(configDir, id) {
    const d = load(configDir);
    const left = d.devices.filter((x) => x.id !== id);
    if (left.length === d.devices.length) return false;
    d.devices = left;
    save(configDir, d);
    return true;
}

function devicesOf(configDir) {
    return load(configDir).devices.map((x) => ({ id: x.id, name: x.name, paired: x.paired, seen: x.seen }));
}

function tokenOf(cookieHeader) {
    const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{20,})').exec(String(cookieHeader || ''));
    return m ? m[1] : null;
}

function cookieFor(token) {
    return COOKIE + '=' + token + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict';
}

module.exports = { hostKind, sameOrigin, policy, newCode, liveCode, pair, deviceFor, revoke, devicesOf, tokenOf, cookieFor };
