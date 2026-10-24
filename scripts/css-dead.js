#!/usr/bin/env node
'use strict';
// CSS classes nothing names (audit-4).
//
//   node scripts/css-dead.js [--json] <dir>...
//
// Every `.css` file under the given directories is read for class selectors,
// and every `.js`, `.mjs`, `.cjs`, `.ts`, `.jsx`, `.tsx`, `.html`, `.htm`,
// `.vue` and `.svelte` file under the same directories is read as a
// reference. A class whose name is a whole token — bounded by anything that
// is not a letter, digit, `_` or `-` — in some reference file is used. One
// that is not, but whose leading segment (`tag-` of `tag-ok`) is followed in
// some reference file by a closing quote and `+`, or by `${`, is "maybe": built
// in a string at run time, which no static reading settles. The rest are
// dead. `node_modules`, `.git`, `.fankeel`, `.claude`, `dist`, `build`,
// `coverage` and the test directories (`tests`, `test`, `__tests__`) are not
// walked: a test asserting a class is gone names it, and would keep it alive.
// A class only a suffix builds (`x + '-bar'`) reads as dead; so does one only
// server-side HTML outside the given directories writes — give the project
// root, not one assets folder.
//
// Why a script of ours rather than an existing tool (checked 2026-10-25):
// PurgeCSS and UnCSS are npm packages, and this repository takes no
// dependency (package.json has no `dependencies`; CONTRIBUTING.md). PurgeCSS
// also answers another question — it writes the CSS that survives instead of
// listing what dies — and its default extractor is the same token match done
// here. UnCSS loads pages in jsdom and keeps what the rendered DOM matches,
// so a class that appears only after a click or a route change reads as dead,
// which on the station is most of them. The browser's CSS coverage (DevTools
// Coverage, Puppeteer's `page.coverage.startCSSCoverage()`) is per page load
// and per interaction: it needs every view driven by hand, a measurement
// rather than a scan.
//
// Exit 1 when anything is dead, 0 otherwise; "maybe" never fails it.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgsOrExit } = require('../lib/cli.js');

const SKIP = new Set(['node_modules', '.git', '.fankeel', '.claude', 'dist', 'build', 'coverage', 'tests', 'test', '__tests__']);
const REFS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.html', '.htm', '.vue', '.svelte']);

function walk(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP.has(e.name)) walk(p, out);
        } else if (e.isFile()) {
            out.push(p);
        }
    }
    return out;
}

// The class names in one stylesheet's selectors, each with its line, each
// name once. Comments, quoted strings and url(...) are blanked first, their
// newlines kept, so `content:".x"` is no selector and lines still count. The
// text before every `{`, back to the previous `{`, `}` or `;`, is a selector
// or an at-rule's prelude; only selectors are read.
function classesIn(css) {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    const text = String(css)
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank)
        .replace(/url\([^)]*\)/g, blank);
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    const lineAt = (at) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= at) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const out = [];
    const seen = new Set();
    for (const m of text.matchAll(/([^{};]+)\{/g)) {
        if (m[1].trim().startsWith('@')) continue;
        for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
            if (seen.has(c[1])) continue;
            seen.add(c[1]);
            out.push({ name: c[1], line: lineAt(m.index + c.index) });
        }
    }
    return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The leading segment a reference builds in a string, or null: every prefix
// of `name` that ends in `-` or `_`, shortest first.
function builtPrefix(name, corpus) {
    for (let i = 0; i < name.length; i++) {
        if (name[i] !== '-' && name[i] !== '_') continue;
        const prefix = name.slice(0, i + 1);
        if (new RegExp('(?:^|[^\\w-])' + esc(prefix) + '(?:[\'"`]\\s*\\+|\\$\\{)').test(corpus)) return prefix;
    }
    return null;
}

function scan(dirs) {
    const files = [];
    for (const d of dirs) walk(path.resolve(d), files);
    const corpus = files.filter((f) => REFS.has(path.extname(f).toLowerCase())).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const tokens = new Set(corpus.match(/[\w-]+/g) || []);
    const sheets = files.filter((f) => path.extname(f).toLowerCase() === '.css');
    const dead = [];
    const maybe = [];
    let total = 0;
    for (const file of sheets) {
        for (const c of classesIn(fs.readFileSync(file, 'utf8'))) {
            total++;
            if (tokens.has(c.name)) continue;
            const prefix = builtPrefix(c.name, corpus);
            if (prefix) maybe.push({ file, line: c.line, name: c.name, prefix });
            else dead.push({ file, line: c.line, name: c.name });
        }
    }
    return { dead, maybe, total, css: sheets.length };
}

function main(argv) {
    const { values, positionals } = parseArgsOrExit('css-dead', argv, { json: { type: 'boolean' } });
    const dirs = positionals.length ? positionals : ['.'];
    for (const d of dirs) {
        try {
            fs.readdirSync(d);
        } catch (e) {
            process.stderr.write('css-dead: cannot read ' + d + ' (' + e.code + ')\n');
            process.exitCode = 2;
            return;
        }
    }
    const r = scan(dirs);
    if (values.json) {
        process.stdout.write(JSON.stringify(r) + '\n');
    } else {
        const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join('/');
        const lines = ['css-dead — ' + r.dead.length + ' dead, ' + r.maybe.length + ' maybe, of ' + r.total + ' classes in ' + r.css + ' stylesheets'];
        for (const d of r.dead) lines.push('dead   ' + rel(d.file) + ':' + d.line + '  .' + d.name);
        for (const m of r.maybe) lines.push('maybe  ' + rel(m.file) + ':' + m.line + '  .' + m.name + '  (' + m.prefix + ' is built in a string)');
        process.stdout.write(lines.join('\n') + '\n');
    }
    process.exitCode = r.dead.length ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { classesIn, scan };
