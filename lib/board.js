'use strict';
// A task's Chartroom boards: the `*.board` files directly in its build
// directory (`handoff.dirFor`, lib/handoff.js), listed for the station's
// session card and drawn to SVG by the render code vendored under
// lib/chartroom/ — ESM, loaded once with dynamic import(), which needs no
// flag on the Node 22.5 floor (docs/90-agent/plans/2026-10-20-chartroom-board-design.md §2).
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

module.exports = { NAME, listBoards, boardFile, renderBoard };
