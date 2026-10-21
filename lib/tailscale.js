'use strict';
// The station's tailnet address (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §2), VoiceLedger's `ensure_tailscale_serve`: the machine's MagicDNS name from
// `tailscale status --json`, and `tailscale serve --bg <port>` run only when
// `tailscale serve status --json` shows no proxy to that port yet. `disable`
// runs `tailscale serve --https=443 off` for a proxy the caller made. Never
// `tailscale funnel`; with Funnel on for the machine remote stays off. Every
// failure is a warning the caller prints, never a throw. `run` is the seam the
// tests fake; without one the real CLI is run, five seconds a call at most.
const { spawnSync } = require('node:child_process');

const TIMEOUT_MS = 5000;

function runTailscale(args) {
    const r = spawnSync('tailscale', args, { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
    if (r.error) return { status: null, stdout: '', stderr: String(r.error.message || r.error) };
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const firstLine = (s) => String(s || '').trim().split(/\r?\n/)[0] || 'no output';
const parsed = (text) => {
    try { return JSON.parse(text); } catch (e) { return undefined; }
};

function selfName(run) {
    const r = (run || runTailscale)(['status', '--json']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale is not installed or not answering: ' + firstLine(r.stderr) };
    const s = parsed(r.stdout);
    if (!s || typeof s !== 'object') return { ok: false, warning: 'tailscale status --json did not parse' };
    if (s.BackendState !== 'Running') return { ok: false, warning: 'tailscale is ' + (s.BackendState || 'not running') + ', not Running' };
    const name = s.Self && typeof s.Self.DNSName === 'string' ? s.Self.DNSName.replace(/\.$/, '') : '';
    if (!name) return { ok: false, warning: 'this machine has no MagicDNS name: turn on MagicDNS and HTTPS certificates in the tailnet\'s admin console' };
    return { ok: true, dnsName: name };
}

// Every reverse proxy a serve config holds, as `Web[hostPort].Handlers[mount].Proxy`.
function proxiesOf(status) {
    const out = [];
    const web = status && status.Web && typeof status.Web === 'object' ? status.Web : {};
    for (const hostPort of Object.keys(web)) {
        const handlers = (web[hostPort] && web[hostPort].Handlers) || {};
        for (const mount of Object.keys(handlers)) {
            const h = handlers[mount];
            if (h && typeof h.Proxy === 'string') out.push({ hostPort, mount, proxy: h.Proxy });
        }
    }
    return out;
}

function ensureServe(port, run) {
    const go = run || runTailscale;
    const r = go(['serve', 'status', '--json']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale serve status failed: ' + firstLine(r.stderr || r.stdout) };
    const status = r.stdout.trim() ? parsed(r.stdout) : {};
    if (!status || typeof status !== 'object') return { ok: false, warning: 'tailscale serve status --json did not parse' };
    const funnel = status.AllowFunnel && typeof status.AllowFunnel === 'object' && Object.values(status.AllowFunnel).some((v) => v === true);
    if (funnel) return { ok: false, warning: 'Funnel is on for this machine, which would put the station on the public internet; remote stays off until Funnel is turned off' };
    const target = 'http://127.0.0.1:' + port;
    const proxies = proxiesOf(status);
    if (proxies.some((p) => p.proxy.replace(/\/+$/, '') === target)) return { ok: true, already: true };
    const taken = proxies.find((p) => p.mount === '/' && /:443$/.test(p.hostPort));
    if (taken) return { ok: false, warning: 'tailscale serve already proxies ' + taken.hostPort + '/ to ' + taken.proxy + '; not replaced' };
    const made = go(['serve', '--bg', String(port)]);
    if (made.status !== 0) return { ok: false, warning: 'tailscale serve --bg ' + port + ' failed: ' + firstLine(made.stderr || made.stdout) };
    return { ok: true, already: false };
}

function enable(port, run) {
    const go = run || runTailscale;
    const self = selfName(go);
    if (!self.ok) return self;
    const served = ensureServe(port, go);
    if (!served.ok) return served;
    return { ok: true, dnsName: self.dnsName, url: 'https://' + self.dnsName + '/', already: served.already };
}

// The proxy `ensureServe` made, taken down (station-remote-1): `serve --bg
// <port>` puts an HTTPS handler on 443, and `serve --https=443 off` removes
// it. The caller runs this only for a proxy it made itself. A warning, never
// a throw: a station shutting down must not stop on it.
function disable(run) {
    const r = (run || runTailscale)(['serve', '--https=443', 'off']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale serve --https=443 off failed: ' + firstLine(r.stderr || r.stdout) };
    return { ok: true };
}

module.exports = { selfName, proxiesOf, ensureServe, enable, disable };
