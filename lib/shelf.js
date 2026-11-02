'use strict';
// The shelf: ended sessions and the build directories they own, moved out of
// the repository into the config directory and indexed with node:sqlite, never
// deleted (docs/90-agent/plans/2026-11-02-session-shelf-design.md).
//
// Every move is a copy, a count and only then a removal: the config directory
// and the repository are often on different drives, where a rename fails.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readObject } = require('./json.js');
const { liveConfigDir } = require('./live.js');
const { dirFor } = require('./handoff.js');

const DAYS = 14;
const ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

function shelfRoot() {
    return path.join(liveConfigDir(), 'fankeel', 'shelf');
}

// One directory per registry root: its name, then a hash of its absolute path
// so two roots that share a name do not share a shelf.
function shelfDir(root) {
    const abs = path.resolve(root);
    const hash = crypto.createHash('sha1').update(abs.toLowerCase()).digest('hex').slice(0, 8);
    return path.join(shelfRoot(), path.basename(abs) + '-' + hash);
}

function eligible(data, now, days) {
    if (!data || data.active !== false || !data.ended) return false;
    const at = Date.parse(data.updated || data.ended);
    return Number.isFinite(at) && at < now - days * 86400000;
}

function countTree(at) {
    const st = fs.statSync(at);
    if (!st.isDirectory()) return { files: 1, bytes: st.size };
    let files = 0;
    let bytes = 0;
    for (const d of fs.readdirSync(at, { recursive: true, withFileTypes: true })) {
        if (!d.isFile()) continue;
        files += 1;
        bytes += fs.statSync(path.join(d.parentPath, d.name)).size;
    }
    return { files, bytes };
}

// True once `dst` holds what `src` held and `src` is gone. A copy that does not
// match is removed and `src` is left where it was.
function moveTree(src, dst) {
    if (fs.existsSync(dst)) return false;
    const want = countTree(src);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true, errorOnExist: true, force: false });
    const got = countTree(dst);
    if (got.files !== want.files || got.bytes !== want.bytes) {
        fs.rmSync(dst, { recursive: true, force: true });
        return false;
    }
    fs.rmSync(src, { recursive: true, force: true });
    return true;
}

function readDir(dir) {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const sessionId = name.slice(0, -'.json'.length);
        if (!ID.test(sessionId)) continue;
        const data = readObject(path.join(dir, name));
        if (data) out.push({ sessionId, data });
    }
    return out;
}

function readShelved(root) {
    return readDir(path.join(shelfDir(root), 'sessions'));
}

function indexPath() {
    return path.join(shelfRoot(), 'index.sqlite');
}

function openIndex() {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(shelfRoot(), { recursive: true });
    const db = new DatabaseSync(indexPath());
    db.exec('CREATE TABLE IF NOT EXISTS entries (root TEXT, id TEXT, project TEXT, task TEXT, stage TEXT, started TEXT, ended TEXT, spend TEXT, file TEXT, build TEXT, PRIMARY KEY (root, id))');
    return db;
}

function index(rows) {
    const db = openIndex();
    try {
        const put = db.prepare('INSERT OR REPLACE INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const r of rows) put.run(r.root, r.id, r.project, r.task, r.stage, r.started, r.ended, r.spend, r.file, r.build);
    } finally {
        db.close();
    }
}

function find(term) {
    if (!fs.existsSync(indexPath())) return [];
    const db = openIndex();
    try {
        const like = '%' + String(term) + '%';
        return db.prepare('SELECT * FROM entries WHERE id LIKE ? OR task LIKE ? OR project LIKE ? ORDER BY started')
            .all(like, like, like).map((r) => Object.assign({}, r));
    } finally {
        db.close();
    }
}

const text = (v) => (typeof v === 'string' ? v : '');

function run(root, opts = {}) {
    const days = Number.isInteger(opts.days) && opts.days >= 0 ? opts.days : DAYS;
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const local = readDir(path.join(root, '.fankeel', 'sessions'));
    const going = local.filter((e) => eligible(e.data, now, days));
    // A build directory a staying entry still maps to (a rename keeps
    // `started`) stays with it.
    const staying = new Set(local.filter((e) => !going.includes(e)).map((e) => dirFor(root, e.data)).filter(Boolean));
    const shelf = shelfDir(root);
    const out = { sessions: 0, builds: 0, files: 0, kept: [] };
    const rows = [];
    for (const e of going) {
        const build = dirFor(root, e.data);
        const takeBuild = Boolean(build) && !staying.has(build) && fs.existsSync(build);
        if (opts.dryRun === true) {
            out.sessions += 1;
            if (takeBuild) out.builds += 1;
            continue;
        }
        const src = path.join(root, '.fankeel', 'sessions', e.sessionId + '.json');
        const dst = path.join(shelf, 'sessions', e.sessionId + '.json');
        if (!moveTree(src, dst)) {
            out.kept.push(src);
            continue;
        }
        out.sessions += 1;
        out.files += 1;
        let shelved = null;
        if (takeBuild) {
            const files = countTree(build).files;
            const bdst = path.join(shelf, 'build', path.basename(build));
            if (moveTree(build, bdst)) {
                out.builds += 1;
                out.files += files;
                shelved = bdst;
            } else {
                out.kept.push(build);
            }
        }
        const d = e.data;
        rows.push({ root: path.resolve(root), id: e.sessionId, project: text(d.project), task: text(d.task), stage: text(d.stage), started: text(d.started), ended: text(d.ended), spend: JSON.stringify(d.spend === undefined ? null : d.spend), file: dst, build: shelved });
    }
    // The files are already moved; an index that fails to write is reported,
    // not undone, because nothing reads the index to find an entry's file.
    if (rows.length) {
        try {
            index(rows);
        } catch (err) {
            out.indexError = err.message;
        }
    }
    return out;
}

function restore(root, id) {
    if (!ID.test(String(id))) return false;
    const shelf = shelfDir(root);
    const src = path.join(shelf, 'sessions', id + '.json');
    const data = readObject(src);
    if (!data) return false;
    if (!moveTree(src, path.join(root, '.fankeel', 'sessions', id + '.json'))) return false;
    const build = dirFor(root, data);
    if (build) {
        const from = path.join(shelf, 'build', path.basename(build));
        if (fs.existsSync(from) && !fs.existsSync(build)) moveTree(from, build);
    }
    if (fs.existsSync(indexPath())) {
        try {
            const db = openIndex();
            try {
                db.prepare('DELETE FROM entries WHERE root = ? AND id = ?').run(path.resolve(root), id);
            } finally {
                db.close();
            }
        } catch (err) {
            // A stale index row names a file that is no longer there; `find`
            // shows it and nothing else reads it.
        }
    }
    return true;
}

module.exports = { DAYS, shelfRoot, shelfDir, eligible, run, restore, readShelved, find };
