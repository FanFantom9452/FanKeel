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
        ]).then(([format, measure, built, svg]) => ({
            parse: format.parse, rootOf: format.rootOf, approxMeasure: measure.approxMeasure, scene: built.scene, toSVG: svg.toSVG,
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
            return plain(res, 404, 'no architecture board here: put one at ' + file);
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

module.exports = { NAME, listBoards, boardFile, renderBoard, boardPage };
