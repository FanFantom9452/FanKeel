'use strict';
// assets/station/remote-card.js — the 手機遠端 card under the wizard on
// #/settings (docs/90-agent/plans/2026-10-21-station-remote-design.md §3;
// mockup blocks remote-on, remote-off): the `station.remote` switch, the
// tailnet url with 複製, a QR of the live pairing code with the code typed
// out and 換一個, the paired phones with 解除, and the three ntfy triggers.
// Its state is GET /station/remote, which answers loopback only: asked once
// when the card is first drawn and again after each action, and held in
// between, so the page's redraw draws the held card rather than starting
// over. The icons are Lucide (ISC), as in the mockup, inlined because the
// mockup's sprite is not on this page. Loaded before station.js, whose
// settingsPage calls `html(serve)`.
(function (w, doc) {
    var EN = {
        'rm.title': 'Phone remote',
        'rm.on': 'On',
        'rm.off': 'Off',
        'rm.loading': 'Reading the remote state…',
        'rm.local': 'Only this computer can see it (127.0.0.1)',
        'rm.unread': 'Could not read the remote state: {why}',
        'rm.gone': 'serve did not answer',
        'rm.linked': 'Tailscale connected',
        'rm.notLinked': 'Tailscale is not serving the station: {why}',
        'rm.copy': 'Copy',
        'rm.copied': 'Copied',
        'rm.qr': 'Pairing QR',
        'rm.scan': 'Scan this QR with the phone',
        'rm.once': 'One-time, valid for 10 minutes.',
        'rm.newCode': 'New code',
        'rm.paired': 'Paired',
        'rm.none': 'No phone paired yet',
        'rm.revoke': 'Unpair',
        'rm.ntfy': 'ntfy push',
        'rm.gate': 'gate waiting',
        'rm.stage': 'stage done',
        'rm.end': 'task ended',
        'rm.subscribe': 'Subscribe to',
        'rm.noTopic': 'turning one on makes a topic',
        'rm.justNow': 'just now',
        'rm.minutes': '{n} min ago',
        'rm.hours': '{n} h ago',
        'rm.days': '{n} d ago',
        'rm.unsent': 'Not sent: is serve still running?',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }

    var PHONE = '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>';
    var COPY = '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>';
    var REFRESH = '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path>'
        + '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path>';
    function ico(paths, size) {
        return '<svg class="ico" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    }

    function ago(at, now) {
        var s = Math.round((now - at) / 1000);
        if (!(s >= 60)) return loc('rm.justNow', '剛剛');
        if (s < 3600) return loc('rm.minutes', '{n} 分鐘前', { n: Math.floor(s / 60) });
        if (s < 86400) return loc('rm.hours', '{n} 小時前', { n: Math.floor(s / 3600) });
        return loc('rm.days', '{n} 天前', { n: Math.floor(s / 86400) });
    }

    // The header: the phone glyph, the title and the switch. `wait` is the
    // placeholder's, whose switch cannot be pressed before the state is known.
    function head(on, wait) {
        return '<div class="dcard-h">' + ico(PHONE, 16) + '<b>' + loc('rm.title', '手機遠端') + '</b><span class="sp"></span>'
            + '<label class="m-switch"><span>' + (on ? loc('rm.on', '開') : loc('rm.off', '關')) + '</span>'
            + '<input type="checkbox" data-rm="switch"' + (on ? ' checked' : '') + (wait ? ' disabled' : '')
            + ' aria-label="' + loc('rm.title', '手機遠端') + '"><span class="tr"></span></label></div>';
    }
    function card(block, inner) {
        return '<section class="dcard rm' + (block === 'remote-off' ? ' rm-off' : '') + '" id="rm-card" data-block="' + block + '">' + inner + '</section>';
    }
    function status(dot, text) {
        return '<div class="rm-st"><i class="dot ' + dot + '"></i>' + text + '</div>';
    }
    function pair(code) {
        return '<div class="rm-pair"><div class="qr" role="img" aria-label="' + loc('rm.qr', '配對 QR') + '">'
            + '<img src="/station/remote/qr.svg?c=' + encodeURIComponent(code) + '" alt=""></div>'
            + '<div><h3>' + loc('rm.scan', '用手機掃這個 QR') + '</h3>'
            + '<p>' + loc('rm.once', '一次性，10 分鐘內有效。') + '</p>'
            + '<code class="rm-code">' + esc(code) + '</code>'
            + '<button type="button" class="btn" data-rm="code">' + ico(REFRESH, 14) + loc('rm.newCode', '換一個') + '</button></div></div>';
    }
    function devices(list, now) {
        var rows = list.map(function (d) {
            return '<span class="rm-dev">' + ico(PHONE, 18) + '<span>' + esc(d.name) + ' · ' + ago(d.seen, now) + '</span>'
                + '<button type="button" class="btn" data-rm="revoke" data-id="' + esc(d.id) + '">' + loc('rm.revoke', '解除') + '</button></span>';
        }).join('');
        var none = '<span class="rm-none">' + loc('rm.none', '還沒有配對的手機') + '</span>';
        return '<div class="rm-sub"><b>' + loc('rm.paired', '已配對') + '</b><span class="rm-devs">' + (rows || none) + '</span></div>';
    }
    function triggers(n) {
        var label = {
            gate: loc('rm.gate', 'gate 待答'),
            stage: loc('rm.stage', 'stage 完成'),
            end: loc('rm.end', '任務結束'),
        };
        var boxes = ['gate', 'stage', 'end'].map(function (k) {
            return '<label><input type="checkbox" data-rm="trigger" data-key="notify.' + k + '"' + (n[k] === true ? ' checked' : '') + '>' + label[k] + '</label>';
        }).join('');
        var where = esc(String(n.server || '').replace(/\/+$/, '') + '/' + n.topic);
        var topic = n.topic
            ? loc('rm.subscribe', '訂閱') + ' <code>' + where + '</code>'
            : loc('rm.noTopic', '打開任一個就會產生 topic');
        return '<div class="rm-sub"><b>' + loc('rm.ntfy', 'ntfy 推播') + '</b><span class="rm-trg">' + boxes + '</span></div><p class="rm-topic">' + topic + '</p>';
    }

    // One /station/remote answer as the card. Off (or an answer that failed)
    // is the mockup's remote-off; on is remote-on, with the url, the QR and
    // the phones only while Tailscale is serving the station.
    function view(state, now) {
        var S = state || {};
        var said = S.said ? '<p class="rm-say">' + esc(S.said) + '</p>' : '';
        if (S.error) return card('remote-off', head(false) + status('down', loc('rm.unread', '讀不到手機遠端的狀態：{why}', { why: esc(S.error) })) + said);
        if (!S.on) return card('remote-off', head(false) + status('down', loc('rm.local', '只在這台電腦看得到（127.0.0.1）')) + said);
        var body = head(true);
        if (!S.active) {
            body += status('stale', loc('rm.notLinked', 'Tailscale 沒有替測站開門：{why}', { why: esc(S.warning || '') }));
        } else {
            body += status('live', loc('rm.linked', 'Tailscale 已連上') + ' <span class="mono">' + esc(String(S.dnsName || '').split('.')[0]) + '</span>')
                + '<div class="rm-url"><code>' + esc(S.url) + '</code><button type="button" class="btn" data-rm="copy" data-url="' + esc(S.url) + '">'
                + ico(COPY, 14) + loc('rm.copy', '複製') + '</button></div>';
            if (S.code) body += pair(S.code);
            body += devices(S.devices || [], now);
        }
        return card('remote-on', body + triggers(S.notify || {}) + said);
    }
    function waiting() {
        return card('remote-off', head(false, true) + status('down', loc('rm.loading', '讀取手機遠端的狀態…')));
    }

    var held = null;
    var asking = false;
    function paint() {
        var el = doc && doc.getElementById('rm-card');
        if (el) el.outerHTML = view(held, Date.now());
    }
    // `note` is the reason the last action was refused, shown once.
    function load(note) {
        if (typeof fetch !== 'function') return;
        asking = true;
        fetch('/station/remote', { cache: 'no-store' }).then(function (r) {
            return r.ok ? r.json() : { error: String(r.status) };
        }).catch(function () {
            return { error: loc('rm.gone', 'serve 沒有回應') };
        }).then(function (s) {
            asking = false;
            held = Object.assign({}, s);
            if (note) held.said = note;
            paint();
        });
    }
    function post(url, fields) {
        var body = new URLSearchParams();
        body.set('nonce', (w && w.STATION && w.STATION.nonce) || '');
        Object.keys(fields).forEach(function (k) { body.set(k, fields[k]); });
        return fetch(url, { method: 'POST', body: body }).then(function (r) {
            return r.ok ? '' : r.text().then(function (t) { return r.status + ' — ' + String(t).trim(); });
        }, function () {
            return loc('rm.unsent', '送不出去：serve 還在跑嗎？');
        }).then(load);
    }
    function html(serve) {
        if (!serve) return '';
        if (!held) {
            if (!asking) load();
            return waiting();
        }
        return view(held, Date.now());
    }

    // Delegated on the document, because station.js redraws the page and the
    // card with it; a checkbox's click is left to its change event.
    function controlOf(e) {
        var t = e && e.target;
        return t && t.closest ? t.closest('#rm-card [data-rm]') : null;
    }
    if (doc && doc.addEventListener) {
        doc.addEventListener('change', function (e) {
            var c = controlOf(e);
            if (!c) return;
            var kind = c.getAttribute('data-rm');
            var value = c.checked ? 'true' : 'false';
            if (kind === 'switch') post('/profile', { scope: 'machine', key: 'station.remote', value: value });
            else if (kind === 'trigger') post('/profile', { scope: 'machine', key: c.getAttribute('data-key'), value: value });
        });
        doc.addEventListener('click', function (e) {
            var c = controlOf(e);
            if (!c) return;
            var kind = c.getAttribute('data-rm');
            if (kind === 'code') post('/station/remote/code', {});
            else if (kind === 'revoke') post('/station/remote/revoke', { id: c.getAttribute('data-id') });
            else if (kind === 'copy' && w && w.navigator && w.navigator.clipboard) {
                w.navigator.clipboard.writeText(c.getAttribute('data-url')).then(function () {
                    c.textContent = loc('rm.copied', '已複製');
                }, function () {});
            }
        });
    }

    var api = { html: html, view: view, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_REMOTE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
