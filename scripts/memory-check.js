#!/usr/bin/env node
'use strict';

// Whether Claude Code's own memory for this project still points at
// something real.
//
//   node memory-check.js [--root <project>] [--config-dir <dir>]
//
// Claude Code writes here and never prunes it. Nothing else in this plugin
// ever reads it, so a path a memory entry cites can go dead — or move —
// with nothing noticing but the next person who trusts the entry. This
// reuses `docs-check.js`'s own machinery for the reference-checking half
// rather than writing a second regex for a claim this repository already
// knows how to check.
//
// Only a path whose first segment is a top-level entry this project actually
// tracks is a claim about this project. A survey pass that guessed at "dead"
// paths by pattern alone found six hits that were every one of them a path
// outside the repository — `~/.claude/...`, another project, a
// `.fankeel/build/` scratch fragment — and reporting those is how a checker
// earns being ignored.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { liveConfigDir } = require('../lib/live.js');
const { resolveRoot } = require('../lib/registry.js');
const { trackedFiles } = require('../lib/tracked.js');
const docs = require('../lib/docs.js');
const { section } = require('../lib/report.js');
const { LINK, CODE, PATHISH, resolveRef, external } = require('./docs-check.js');

const MAX_FINDINGS = 200;

// `F:\ymlab\fankeel` -> `F--ymlab-fankeel`. The three characters a Windows or
// POSIX path can carry that a directory name cannot, each turned into the one
// character every path already avoids — Claude Code's own scheme, read off a
// real memory directory rather than guessed at.
function projectSlug(root) {
    return path.resolve(root).replace(/[:\\/]/g, '-');
}

function memoryDir(configDir, root) {
    return path.join(configDir, 'projects', projectSlug(root), 'memory');
}

function readFile(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

function lineCount(file) {
    const text = readFile(file);
    if (text === null) return null;
    const l = text.split('\n');
    if (l.length && l[l.length - 1] === '') l.pop();
    return l.length;
}

// Every `[title](file.md)` bullet MEMORY.md carries. A bare same-directory
// `.md` name only — a link elsewhere on the page pointing anywhere else is
// not one of the memory files this index is keeping in step with the
// directory.
function indexEntries(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const ref = m[1];
        if (external(ref)) continue;
        if (/^[\w.-]+\.md$/.test(ref)) out.push(ref);
    }
    return out;
}

// One memory file's own citations of this project's code, in the same shape
// `docs-check.js` checks a reference document in: a code span shaped like
// `path` or `path:N`, its first segment a root this project actually tracks.
// The state directory is excluded the same way and for the same reason
// `docs-check.js` excludes it — this project's own `.fankeel/docs.json` is
// tracked, and `.fankeel/build/` is not the runtime's promise to keep
// existing.
function citations(text, roots) {
    const out = [];
    CODE.lastIndex = 0;
    let m;
    while ((m = CODE.exec(text)) !== null) {
        const span = m[1].trim();
        if (span.endsWith('/')) continue;
        const hit = PATHISH.exec(span);
        if (!hit) continue;
        const ref = hit[1];
        if (ref === docs.STATE_DIR || ref.startsWith(docs.STATE_DIR + '/')) continue;
        if (!roots.has(ref.split('/')[0])) continue;
        out.push({ ref, wanted: hit[2] ? parseInt(hit[2], 10) : null });
    }
    return out;
}

function scan(root, configDir) {
    const dir = memoryDir(configDir, root);
    const indexFile = path.join(dir, 'MEMORY.md');
    const indexText = readFile(indexFile);
    if (indexText === null) return { dir, present: false, findings: [], indexed: 0, onDisk: 0 };

    let names;
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'MEMORY.md');
    } catch (e) {
        names = [];
    }
    const onDisk = new Set(names);
    const indexed = indexEntries(indexText);
    const indexedSet = new Set(indexed);

    const findings = [];
    for (const ref of indexed) {
        if (!onDisk.has(ref)) findings.push({ tag: 'index', what: 'MEMORY.md links ' + ref + ', which is not on disk' });
    }
    for (const name of onDisk) {
        if (!indexedSet.has(name)) findings.push({ tag: 'index', what: name + ' is on disk and not linked from MEMORY.md' });
    }

    const tracked = trackedFiles(root);
    const roots = new Set((tracked ? tracked.files : []).map((f) => f.split('/')[0]));

    for (const name of onDisk) {
        const text = readFile(path.join(dir, name));
        if (text === null) continue;
        for (const { ref, wanted } of citations(text, roots)) {
            const found = resolveRef(root, '', ref);
            if (found === null) {
                findings.push({ tag: 'dead', what: name + ' cites ' + ref + ', which no longer exists' });
                continue;
            }
            if (wanted !== null) {
                const n = lineCount(path.join(root, found.split('/').join(path.sep)));
                if (n !== null && wanted > n) {
                    findings.push({ tag: 'past-end', what: name + ' cites ' + ref + ':' + wanted + ' but the file ends at ' + n });
                }
            }
        }
    }

    return { dir, present: true, findings, indexed: indexed.length, onDisk: onDisk.size };
}

function report(result) {
    if (!result.present) {
        return 'fankeel memory-check: no native memory yet at ' + result.dir + ' — nothing to check.';
    }
    const lines = [];
    lines.push('fankeel memory-check — ' + result.dir);
    lines.push('  ' + result.indexed + ' indexed, ' + result.onDisk + ' on disk');
    lines.push(...section(result.findings.length + (result.findings.length === 1 ? ' finding:' : ' findings:'),
        result.findings.map((f) => f.tag + ': ' + f.what), MAX_FINDINGS));
    if (!result.findings.length) {
        lines.push('');
        lines.push('Every entry is indexed both ways, and every cited repository path still');
        lines.push('exists where it says it does.');
    }
    return lines.join('\n');
}

function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, 'config-dir': { type: 'string' }, quiet: { type: 'boolean' } },
    });
    return {
        root: resolveRoot(values.root),
        configDir: typeof values['config-dir'] === 'string' && values['config-dir'] ? path.resolve(values['config-dir']) : liveConfigDir(),
        quiet: Boolean(values.quiet),
    };
}

function main(argv) {
    const { root, configDir, quiet } = parseArgs(argv);
    const result = scan(root, configDir);
    const text = report(result);
    const bad = result.present && result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    if (text) process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { scan, report, parseArgs, main, projectSlug, memoryDir, indexEntries, citations };
