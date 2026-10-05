'use strict';
// Preloaded with `node --require`. Logs, to INJECT_TIMING_LOG at exit: when
// this process reached the shim (node's own start), every require of a plugin
// file that took 1ms or more, every top-level call into a plugin module's
// exports (a call made while another is running is not logged on its own),
// and when the process exited. A promise-returning call is timed to settle.
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const LOG = process.env.INJECT_TIMING_LOG;
const PLUGIN = path.resolve(process.env.INJECT_TIMING_PLUGIN || '.');
const lines = ['start ' + performance.now().toFixed(1)];
const wrapped = new WeakSet();
let depth = 0;

const orig = Module._load;
Module._load = function (request, parent, isMain) {
    const t0 = performance.now();
    const out = orig.apply(this, arguments);
    const ms = performance.now() - t0;
    // A builtin resolves to its own name, which path.relative reads as a file under the cwd.
    if (Module.isBuiltin(request)) return out;
    let file = request;
    try { file = Module._resolveFilename(request, parent, isMain); } catch (e) { /* unresolvable: leave file unset */ }
    const rel = path.relative(PLUGIN, String(file)).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel) || rel.includes('node_modules')) return out;
    if (ms >= 1) lines.push('require ' + rel + ' ' + ms.toFixed(1));
    if (!out || typeof out !== 'object' || wrapped.has(out)) return out;
    wrapped.add(out);
    for (const k of Object.keys(out)) {
        const fn = out[k];
        if (typeof fn !== 'function' || /^[A-Z]/.test(k)) continue;
        out[k] = function () {
            if (depth > 0) return fn.apply(this, arguments);
            depth++;
            const s = performance.now();
            let r;
            try { r = fn.apply(this, arguments); } finally { depth--; }
            const done = () => lines.push('call ' + rel + ' ' + k + ' ' + (performance.now() - s).toFixed(1));
            if (r && typeof r.then === 'function') r.then(done, done); else done();
            return r;
        };
    }
    return out;
};

process.on('exit', () => {
    lines.push('exit ' + performance.now().toFixed(1));
    if (LOG) fs.appendFileSync(LOG, lines.join('\n') + '\n---\n');
});
