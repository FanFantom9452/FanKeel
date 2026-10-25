'use strict';
// The /m page booted against a document that keeps #app as one html string and finds .cv and its <details>
// inside it, so a test can open a row, patch or redraw, and read what is left open.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const reply = (body) => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
const settle = () => new Promise((r) => setTimeout(r, 30));

// [start, end) of the .cv contents, found by counting <div and </div>.
function span(h) {
    const m = /<div class="cv"[^>]*>/.exec(h);
    if (!m) return null;
    const from = m.index + m[0].length;
    const re = /<(\/?)div\b/g;
    re.lastIndex = from;
    let depth = 1, x;
    while ((x = re.exec(h))) { depth += x[1] ? -1 : 1; if (!depth) return [from, x.index]; }
    return null;
}

// `state` is { home, one }: what mobile.json and phone.json answer now. Change it between fires.
function boot(hash, state) {
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const app = { html: '', get innerHTML() { return this.html; }, set innerHTML(v) { this.html = v; } };
    const cv = {
        scrollTop: 0, scrollHeight: 0, clientHeight: 0,
        get innerHTML() { const s = span(app.html); return app.html.slice(s[0], s[1]); },
        set innerHTML(v) { const s = span(app.html); app.html = app.html.slice(0, s[0]) + v + app.html.slice(s[1]); },
        querySelectorAll(sel) {
            const s = span(app.html);
            const re = /<details data-k="([^"]*)"( open)?>/g;
            const out = [];
            let m;
            while ((m = re.exec(app.html.slice(s[0], s[1])))) {
                if (sel === 'details[open]' && !m[2]) continue;
                const k = m[1];
                out.push({
                    getAttribute: () => k,
                    setAttribute: () => {
                        const at = span(app.html);
                        const tag = '<details data-k="' + k + '">';
                        const i = app.html.indexOf(tag, at[0]);
                        if (i >= 0 && i < at[1]) app.html = app.html.slice(0, i) + '<details data-k="' + k + '" open>' + app.html.slice(i + tag.length);
                    },
                });
            }
            return out;
        },
    };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} },
        addEventListener: listen('doc'), querySelector: (s) => (s === '.cv' && span(app.html) ? cv : null), visibilityState: 'visible',
    };
    const win = {
        document: doc, location: { hash }, navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url) => reply(url === '/station/mobile.json' ? state.home : state.one),
    };
    vm.runInNewContext(SRC, { window: win });
    const fire = (where, type, e) => { (on[where][type] || []).forEach((fn) => fn(e)); return e; };
    return {
        app, win,
        fire: (type, e) => fire('doc', type, e || {}),
        goto: (to) => { win.location.hash = to; fire('win', 'hashchange', {}); },
        // The chat is read again, as the poll does.
        poll: () => { fire('doc', 'visibilitychange', {}); return settle(); },
        // Open the details with this key, as a tap on its summary does.
        open: (k) => cv.querySelectorAll('details').filter((x) => x.getAttribute() === k).forEach((x) => x.setAttribute('open', '')),
        openKeys: () => cv.querySelectorAll('details[open]').map((x) => x.getAttribute()),
    };
}
// A tap or key on an element that carries these attributes; closest finds itself, or the .gpin parent it is given.
function target(attrs, pin) {
    const set = Object.assign({}, attrs);
    const el = { getAttribute: (a) => (Object.prototype.hasOwnProperty.call(set, a) ? set[a] : null), setAttribute: (a, v) => { set[a] = v; }, attrs: set };
    el.closest = (s) => (s === '.gpin' ? pin || null : el);
    return el;
}
module.exports = { boot, target, settle };
