'use strict';
// One reader for a JSON file whose absence or damage is not an error: a
// record a hook or a server may not have written yet, half-written, or
// replaced by hand. Every caller had its own try/catch around
// JSON.parse(fs.readFileSync(...)); this is that, once.

const fs = require('node:fs');

// The parsed contents of `file` when they are a plain object — not an array,
// not null, not a scalar — and null for anything else: no file, a file that
// cannot be read, bytes that do not parse. A leading byte-order mark is
// dropped first, the way lib/registry.js and lib/agentfile.js always did.
function readObject(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return null;
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

// The UTF-8 text of `file`, or null when it cannot be read (absent, a
// directory, no permission).
function readText(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

module.exports = { readObject, readText };
