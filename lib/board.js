'use strict';
// A task's Chartroom boards: the `*.board` files directly in its build
// directory (`handoff.dirFor`, lib/handoff.js), listed for the station's
// session card and drawn to SVG by the render code vendored under
// lib/chartroom/ — ESM, loaded once with dynamic import(), which needs no
// flag on the Node 22.5 floor (docs/99-archive/2026-10-20-chartroom-board-design.md §2).
const fs = require('node:fs');
const path = require('node:path');

// What a board's name — its file name without `.board` — may be: the
// station's route takes it from a URL, and this is what keeps it a name.
const NAME = /^[0-9A-Za-z._-]+$/;
const EXT = '.board';

function listBoards(dir) {
    if (!dir) return [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of entries) {
        if (!d.isFile() || !d.name.endsWith(EXT)) continue;
        const name = d.name.slice(0, -EXT.length);
        if (!NAME.test(name)) continue;
        let st;
        try {
            st = fs.statSync(path.join(dir, d.name));
        } catch (e) {
            continue;
        }
        out.push({ name, updated: Math.round(st.mtimeMs) });
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// The file a name stands for, or null: the name must pass NAME and the
// file must sit directly in `dir`, so no request reaches outside it.
function boardFile(dir, name) {
    if (!dir || typeof name !== 'string' || !NAME.test(name)) return null;
    const base = path.resolve(dir);
    const file = path.resolve(base, name + EXT);
    if (path.dirname(file) !== base) return null;
    try {
        return fs.statSync(file).isFile() ? file : null;
    } catch (e) {
        return null;
    }
}

let loading = null;
function load() {
    if (!loading) {
        loading = Promise.all([
            import('./chartroom/core/format.js'),
            import('./chartroom/geometry/measure.js'),
            import('./chartroom/geometry/scene.js'),
            import('./chartroom/geometry/svg.js'),
            import('./chartroom/core/validate.js'),
            import('./chartroom/core/fields.js'),
        ]).then(([format, measure, built, svg, validate, fields]) => ({
            parse: format.parse, rootOf: format.rootOf, approxMeasure: measure.approxMeasure, scene: built.scene, toSVG: svg.toSVG,
            validateDoc: validate.validateDoc, FIELDS: fields.FIELDS,
        }), (e) => {
            loading = null;
            throw e;
        });
    }
    return loading;
}

// bin/chartroom.js:211-218's recipe, on the board's root view. A malformed
// board rejects with Chartroom's ParseError.
async function renderBoard(text) {
    const m = await load();
    const doc = m.parse(String(text));
    return m.toSVG(m.scene(doc, m.rootOf(doc), m.approxMeasure));
}

// One sentence per code an agent can act on (archify's `validate --json`
// idea, docs/90-agent/judgements/2026-10-26-archify-vs-chartroom.md).
const FIXES = {
    parse: 'Make every line one JSON object; the first line is the header {"chartroom":1,…}.',
    'dup-id': 'Give each record its own id.',
    'no-id': 'Point at an id that exists in this board.',
    'bad-field': 'Use a value the field allows (lib/chartroom/core/fields.js), and give node `in`, edge `in`/`from`/`to`.',
    'bad-ref': 'Point from/to/in/frame at a record that exists, or add that record.',
    'cross-view-edge': 'Keep an edge and both its ends in the same view.',
    'frame-cycle': 'A frame cannot sit inside itself; break the chain of `frame` keys.',
    'unknown-key': 'Drop the key, or move what it says into `label` or `note`; the renderer ignores it.',
};

// The line each record id sits on, read the way format.js reads a line:
// the first key is the kind and its value the id.
function linesOf(text) {
    const at = new Map();
    String(text).split(/\r?\n/).forEach((raw, i) => {
        if (raw.trim() === '') return;
        try {
            const obj = JSON.parse(raw);
            const id = obj && typeof obj === 'object' ? obj[Object.keys(obj)[0]] : undefined;
            if (typeof id === 'string' && !at.has(id)) at.set(id, i + 1);
        } catch (e) { /* parse reports it */ }
    });
    return at;
}

// A board checked the way the station will draw it. `ok` is false on any
// error; warnings (`level: 'warn'`) leave it true.
async function checkBoard(text) {
    const m = await load();
    const problem = (code, id, line, message, level) => ({ code, id, line, message, fix: FIXES[code] || '', level });
    let doc;
    try {
        doc = m.parse(String(text));
    } catch (e) {
        if (!e || e.name !== 'ParseError') throw e;
        return { ok: false, problems: [problem('parse', null, e.line || null, e.message, 'error')] };
    }
    const at = linesOf(text);
    const problems = m.validateDoc(doc).map((p) => problem(p.code, p.id, at.get(p.id) || null, p.message, 'error'));
    for (const rec of Object.values(doc.recs)) {
        const known = m.FIELDS[rec.kind];
        for (const key of Object.keys(rec)) {
            if (key === 'kind' || key === 'id' || Object.hasOwn(known, key)) continue;
            problems.push(problem('unknown-key', rec.id, at.get(rec.id) || null, `unknown key ${key}`, 'warn'));
        }
    }
    return { ok: !problems.some((p) => p.level === 'error'), problems };
}

// The text form of a check, one problem a line, for the CLI.
function checkText(r) {
    if (!r.problems.length) return 'ok: 0 problems';
    return r.problems.map((p) => p.level + ' ' + p.code + (p.id ? ' ' + p.id : '') + (p.line ? ' (line ' + p.line + ')' : '')
        + ': ' + p.message + (p.fix ? ' — ' + p.fix : '')).join('\n');
}

// The station's `/chartroom/<name>/` page (station-chartroom-vendored-1): the
// project's architecture board drawn by the render code vendored above, read-
// only. Chartroom's own editor is not vendored, so nothing here takes a write:
// `GET /` is the page, `GET /board.svg` the drawing, in an <img> so no script
// in a label can run (docs/03-decisions/2026-10-20-task-boards-as-svg.md), any
// other path 404 and any other method 405. `close()` is there because
// scripts/station.js closes every handler it built; this one holds nothing open.
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function boardPage(file, name) {
    const plain = (res, code, msg, extra) => {
        res.writeHead(code, Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, extra));
        res.end(msg + '\n');
    };
    const handler = (req, res) => {
        req.resume();
        if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'this board is read-only here', { allow: 'GET' });
        const at = String(req.url || '/').split(/[?#]/)[0];
        if (at === '/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            return res.end('<!doctype html><meta charset="utf-8"><title>' + escHtml(name) + ' · architecture board</title>'
                + '<style>body{margin:0;background:#fff}img{display:block;max-width:none}</style>'
                + '<img src="board.svg" alt="' + escHtml(name) + ' architecture board">\n');
        }
        if (at !== '/board.svg') return plain(res, 404, 'not here');
        let text;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            if (e && e.code === 'ENOENT') return plain(res, 404, 'no architecture board here: put one at ' + file);
            return plain(res, 500, 'cannot read the architecture board at ' + file + ': ' + (e && e.code || e));
        }
        renderBoard(text).then((svg) => {
            res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
            res.end(svg);
        }, (e) => {
            if (e && e.name === 'ParseError') plain(res, 422, e.message);
            else plain(res, 500, 'cannot draw that board: ' + (e && e.message));
        });
    };
    handler.close = () => {};
    return handler;
}

module.exports = { NAME, listBoards, boardFile, renderBoard, checkBoard, checkText, boardPage, load };
