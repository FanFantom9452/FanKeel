#!/usr/bin/env node
'use strict';

// Every file Claude Code loads into every session's input, how large each
// is, and what in it could go.
//
//   node input-check.js [--root <dir>] [--config-dir <dir>] [--section-bytes <n>]
//
// The global CLAUDE.md under the config directory, each CLAUDE.md above the
// root, each project's CLAUDE.md — the root and every directory directly
// under it — and each of those projects' MEMORY.md. Measured 2026-09-24:
// Telung_DP/CLAUDE.md 15,609 bytes and this project's MEMORY.md 18,533, both
// re-read on every turn of every session opened there. It reports and never
// edits: the cleanup is offered at a gate, and a file in another repository
// is changed only by a task on that repository.
// docs/archive/2026-09-23-needs-a-decision-batch-design.md §6.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { LINK, external } = require('./docs-check.js');
const { memoryDir } = require('./memory-check.js');

const SECTION_BYTES = 4000;
const MAX_PER_FILE = 20;
const SKIP_DIRS = new Set(['node_modules']);

// One token each rather than about a quarter: CJK, Hangul, compatibility
// ideographs and full-width forms. Code points as numbers, because an
// ideograph retyped through a tool can come back as a different one.
const WIDE = [[0x2E80, 0xA4CF], [0xAC00, 0xD7A3], [0xF900, 0xFAFF], [0xFE30, 0xFE4F], [0xFF00, 0xFF60]];
const isWide = (c) => {
    const p = c.codePointAt(0);
    return WIDE.some(([a, b]) => p >= a && p <= b);
};

// An estimate, and the report says so: one token per wide character, one per
// four characters of anything else.
function estimateTokens(text) {
    let wide = 0;
    let other = 0;
    for (const c of String(text)) {
        if (isWide(c)) wide++;
        else other++;
    }
    return wide + Math.ceil(other / 4);
}

const { readText: readFile } = require('../lib/json.js');

function projectsUnder(root) {
    const out = [root];
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const d of entries) {
        if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
        out.push(path.join(root, d.name));
    }
    return out;
}

// Each file once, by absolute path, in the order it is found: global, then
// each project with its MEMORY.md, then every directory above the root.
function sources(root, configDir) {
    const top = path.resolve(root);
    const seen = new Set();
    const out = [];
    const add = (kind, file) => {
        const abs = path.resolve(file);
        if (seen.has(abs)) return;
        const text = readFile(abs);
        if (text === null) return;
        seen.add(abs);
        out.push({ kind, file: abs, text, bytes: Buffer.byteLength(text, 'utf8'), tokens: estimateTokens(text) });
    };
    if (configDir) add('global', path.join(configDir, 'CLAUDE.md'));
    for (const project of projectsUnder(top)) {
        add('project', path.join(project, 'CLAUDE.md'));
        if (configDir) add('memory', path.join(memoryDir(configDir, project), 'MEMORY.md'));
    }
    for (let dir = path.dirname(top); ; dir = path.dirname(dir)) {
        add('parent', path.join(dir, 'CLAUDE.md'));
        if (path.dirname(dir) === dir) break;
    }
    return out;
}

// What two bullets are compared by: the link title when the bullet opens with
// one, else its text — lowercased, punctuation and spacing folded — and the
// file it links. Either one seen before is the same entry said twice.
function keysOf(text) {
    const m = /^\[([^\]]+)\]\(([^)\s#]+)/.exec(text);
    const title = (m ? m[1] : text).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
    const keys = title.length >= 8 ? ['t:' + title] : [];
    if (m) keys.push('l:' + m[2]);
    return keys;
}

function duplicates(text) {
    const first = new Map();
    const out = [];
    String(text).split(/\r?\n/).forEach((line, i) => {
        const b = /^\s*[-*]\s+(.*\S)/.exec(line);
        if (!b) return;
        const keys = keysOf(b[1]);
        const hit = keys.find((k) => first.has(k));
        if (hit) out.push({ tag: 'dup', what: 'line ' + (i + 1) + ' repeats line ' + first.get(hit) + ': ' + b[1].slice(0, 80) });
        for (const k of keys) if (!first.has(k)) first.set(k, i + 1);
    });
    return out;
}

function deadLinks(file, text) {
    const dir = path.dirname(file);
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        let target;
        try {
            target = decodeURIComponent(ref);
        } catch (e) {
            target = ref;
        }
        if (!fs.existsSync(path.resolve(dir, target))) out.push({ tag: 'dead', what: 'links ' + ref + ', which is not there' });
    }
    return out;
}

function bigSections(text, limit) {
    const out = [];
    let head = null;
    let start = 0;
    let bytes = 0;
    const n = (v) => v.toLocaleString('en-US');
    const flush = () => {
        if (head !== null && bytes > limit) out.push({ tag: 'big', what: 'section "' + head + '" (line ' + start + ') is ' + n(bytes) + ' bytes, over ' + n(limit) });
    };
    String(text).split(/\r?\n/).forEach((line, i) => {
        if (/^#{1,6}\s/.test(line)) {
            flush();
            head = line.replace(/^#+\s*/, '');
            start = i + 1;
            bytes = 0;
        }
        bytes += Buffer.byteLength(line, 'utf8') + 1;
    });
    flush();
    return out;
}

function scan(root, configDir, opts) {
    const limit = opts && opts.sectionBytes > 0 ? opts.sectionBytes : SECTION_BYTES;
    const list = sources(root, configDir).map((s) => ({
        kind: s.kind, file: s.file, bytes: s.bytes, tokens: s.tokens,
        findings: [...duplicates(s.text), ...deadLinks(s.file, s.text), ...bigSections(s.text, limit)],
    }));
    list.sort((a, b) => b.bytes - a.bytes);
    return { root: path.resolve(root), configDir, sources: list };
}

function report(result) {
    const n = (v) => v.toLocaleString('en-US');
    const lines = ['fankeel input-check — ' + result.root.replace(/\\/g, '/')];
    if (!result.sources.length) {
        lines.push('  nothing always-loaded found: no global CLAUDE.md, none above here, no project CLAUDE.md or MEMORY.md.');
        return lines.join('\n');
    }
    const bytes = result.sources.reduce((t, s) => t + s.bytes, 0);
    const tokens = result.sources.reduce((t, s) => t + s.tokens, 0);
    lines.push('  ' + result.sources.length + (result.sources.length === 1 ? ' file, ' : ' files, ') + n(bytes) + ' bytes, about '
        + n(tokens) + ' tokens, each loaded into every session opened where it applies');
    lines.push('');
    for (const s of result.sources) {
        lines.push('  ' + n(s.bytes).padStart(8) + ' B  ~' + n(s.tokens).padStart(7) + ' tok  ' + s.kind.padEnd(7) + ' ' + s.file.replace(/\\/g, '/'));
        for (const f of s.findings.slice(0, MAX_PER_FILE)) lines.push('      ' + f.tag + ': ' + f.what);
        if (s.findings.length > MAX_PER_FILE) lines.push('      ... and ' + (s.findings.length - MAX_PER_FILE) + ' more, not listed');
    }
    lines.push('');
    lines.push('Tokens are an estimate: one per CJK character, one per four of anything else.');
    lines.push('Nothing was edited. A trim is offered at a gate; a file in another repository is changed only by a task on it.');
    return lines.join('\n');
}

function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, 'config-dir': { type: 'string' }, 'section-bytes': { type: 'string' } },
    });
    const bytes = parseInt(values['section-bytes'], 10);
    return {
        root: resolveRoot(values.root),
        configDir: typeof values['config-dir'] === 'string' && values['config-dir'] ? path.resolve(values['config-dir']) : liveConfigDir(),
        sectionBytes: Number.isFinite(bytes) && bytes > 0 ? bytes : SECTION_BYTES,
    };
}

// Always 0: this lists, it does not judge. A file being large is what it is
// for, not a failure of the run.
function main(argv) {
    const { root, configDir, sectionBytes } = parseArgs(argv);
    return { text: report(scan(root, configDir, { sectionBytes })), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { scan, report, main, parseArgs, sources, projectsUnder, estimateTokens, duplicates, deadLinks, bigSections };
