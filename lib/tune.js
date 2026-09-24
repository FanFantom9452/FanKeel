'use strict';
// lib/tune.js: the pure half of `scripts/tune.js` — where a `data-block`
// element starts and ends in a file's text, whether an edit stayed inside
// it, the overlay tag spliced into served HTML, a short diff, and the request
// queue read back from its JSONL. No file, socket or clock here.
//
// Blocks are found in the file's text, not a DOM: `data-block="<name>"` has to
// be written literally in the served file, and the element carrying it has to
// close with a matching tag (a void element such as <img> cannot be a block).

const OVERLAY_TAG = '<script src="/__live/overlay.js"></script>';

// Spliced before the last `</body>`, or appended when there is none. Applied
// to the bytes being served; the file on disk is never touched.
function inject(html) {
    const at = html.toLowerCase().lastIndexOf('</body>');
    return at === -1 ? html + OVERLAY_TAG : html.slice(0, at) + OVERLAY_TAG + html.slice(at);
}

// Every `data-block` name in the text, in document order, once each.
function blockNames(html) {
    return [...new Set([...html.matchAll(/data-block\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
}

// [start, end) of the element carrying data-block="<name>": from its `<` to
// just past its matching close tag, counting nested tags of the same name.
// null when the name is absent or the element never closes.
function blockRange(html, name) {
    const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hit = new RegExp('data-block\\s*=\\s*["\']' + quoted + '["\']').exec(html);
    if (!hit) return null;
    const start = html.lastIndexOf('<', hit.index);
    const tag = /^<([A-Za-z][\w-]*)/.exec(html.slice(start));
    if (!tag) return null;
    const re = new RegExp('<(/?)' + tag[1] + '\\b[^>]*>', 'gi');
    re.lastIndex = start;
    let depth = 0;
    let m;
    while ((m = re.exec(html))) {
        if (!m[1] && m[0].endsWith('/>')) continue;
        depth += m[1] ? -1 : 1;
        if (depth === 0) return [start, re.lastIndex];
    }
    return null;
}

// What an edit to block `name` did outside it. `ok` when the text around the
// block is byte-identical before and after; otherwise `touched` names every
// other block whose own text (with `name` cut out of it) changed, or
// `(區塊外)` when the change sits in markup no block owns. A block that
// vanished or no longer closes is reported as itself.
function outside(before, after, name) {
    const a = blockRange(before, name);
    const b = blockRange(after, name);
    if (!a || !b) return { ok: false, touched: [name] };
    const restA = before.slice(0, a[0]) + before.slice(a[1]);
    const restB = after.slice(0, b[0]) + after.slice(b[1]);
    if (restA === restB) return { ok: true, touched: [] };
    const names = blockNames(restA);
    for (const n of blockNames(restB)) if (!names.includes(n)) names.push(n);
    const changed = names.filter((n) => {
        const x = blockRange(restA, n);
        const y = blockRange(restB, n);
        return !x || !y || restA.slice(x[0], x[1]) !== restB.slice(y[0], y[1]);
    });
    // A block that only changed because a block inside it changed is not news.
    const touched = changed.filter((n) => !changed.some((m) => m !== n && contains(restB, n, m)));
    return { ok: false, touched: touched.length ? touched : ['(區塊外)'] };
}

function contains(html, outer, inner) {
    const o = blockRange(html, outer);
    const i = blockRange(html, inner);
    return !!(o && i && o[0] < i[0] && i[1] <= o[1]);
}

// The lines that differ between two texts, after trimming the lines they
// share at both ends: `- ` for the old, `+ ` for the new. Enough to show one
// edit; not a general diff.
function diffLines(a, b) {
    const x = String(a).split('\n');
    const y = String(b).split('\n');
    let head = 0;
    while (head < x.length && head < y.length && x[head] === y[head]) head++;
    let tail = 0;
    while (tail < x.length - head && tail < y.length - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) tail++;
    const gone = x.slice(head, x.length - tail).map((l) => '- ' + l);
    const came = y.slice(head, y.length - tail).map((l) => '+ ' + l);
    return gone.concat(came).map((l) => l + '\n').join('');
}

// The queue is append-only JSONL: one line when a request arrives
// (`status: 'queued'`, with page, file, block and note), one more each time it
// moves (`taken`, `done`, `rejected`). A request's state is its lines merged
// in order, so the last status wins and the first line's fields stay.
function queueState(text) {
    const byId = new Map();
    for (const line of String(text).split('\n')) {
        if (!line.trim()) continue;
        let row;
        try {
            row = JSON.parse(line);
        } catch (e) {
            continue;
        }
        if (!row || !row.id) continue;
        byId.set(row.id, Object.assign({}, byId.get(row.id), row));
    }
    return [...byId.values()];
}


// Every `file:line` whose text holds `data-block="<name>"` literally, over
// `sources` — `[{ file, text }]`, `file` as it should be printed. A name built
// by concatenation is not found, and that is the rule: a block live mode can
// point at is one whose source spells its name.
function sourcesOf(sources, name) {
    const needle = 'data-block="' + name + '"';
    const out = [];
    for (const { file, text } of sources) {
        String(text).split('\n').forEach((line, i) => {
            if (line.includes(needle)) out.push(file + ':' + (i + 1));
        });
    }
    return out;
}

// The paths whose hash differs between two `{ path: hash }` maps — a path in
// one map only counts as changed — sorted, so a message lists them in one order.
function changedPaths(before, after) {
    const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...paths].filter((p) => before[p] !== after[p]).sort();
}

module.exports = { inject, outside, diffLines, queueState, sourcesOf, changedPaths };
