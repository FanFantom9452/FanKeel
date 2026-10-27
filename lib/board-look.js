'use strict';
// How fankeel draws a task's board (docs/99-archive/2026-10-27-board-upgrade-design.md §2):
// a node's category is its `icon` field as `fk:<id>`, painted from the station's
// own series colours (assets/station/station.css:15, --p-0 … --p-5, light), with a
// corner glyph and a legend. Pure: lib/board.js calls it around Chartroom's
// scene and toSVG, and nothing under lib/chartroom/ changes.

// Glyphs are 24×24 stroke paths, drawn in the category's colour.
const CATEGORIES = Object.freeze({
    ui: { name: '介面', color: '#cd5d8e', tint: '#faeef3', glyph: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
    service: { name: '服務', color: '#14938d', tint: '#e7f4f4', glyph: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>' },
    store: { name: '儲存', color: '#6959ae', tint: '#efedf7', glyph: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>' },
    queue: { name: '佇列', color: '#015f98', tint: '#e5eff5', glyph: '<path d="M4 6h16M4 12h16M4 18h10"/>' },
    external: { name: '外部', color: '#8d9793', tint: '#f3f4f4', glyph: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>' },
});
const PREFIX = 'fk:';

// The station's light ground, ink and lines; every key Chartroom's
// DEFAULT_THEME has (lib/chartroom/geometry/shapes.js:9) is set.
const THEME = Object.freeze({
    bg: '#ffffff', grid: '#e6e8e7', nodeFill: '#ffffff', nodeStroke: '#8d9793', text: '#1d2321', mutedText: '#5b6461',
    labelText: '#3a423f', frameFill: '#f6f7f7', frameStroke: '#d9dddb', edge: '#5b6461', accent: '#015f98', aiGlow: '#14938d',
    frameIcon: '#8d9793',
    font: "'Source Sans 3', 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', ui-sans-serif, system-ui, sans-serif",
});

// The change-heat ramp (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 架構圖): the station keel blues, light and dark, level 0 for untouched.
// The weekly report draws nodes with the light fills and its stylesheet maps
// each fill back to --heat-N, so the five light fills must stay distinct.
const ramp = (rows) => Object.freeze(rows.map(([fill, stroke, ink]) => Object.freeze({ fill, stroke, ink })));
const HEAT = Object.freeze({
    light: ramp([
        ['#eaeef1', '#cbd2da', '#5e6775'],
        ['#e3eafb', '#9db4ee', '#18202c'],
        ['#9db4ee', '#6f8fe0', '#18202c'],
        ['#2d5bd8', '#2349b8', '#fbfcfc'],
        ['#1c3a8c', '#152c6b', '#fbfcfc'],
    ]),
    dark: ramp([
        ['#202a38', '#3a4556', '#8d98aa'],
        ['#25314a', '#3d5596', '#e6eaf0'],
        ['#3d5596', '#5a73b8', '#e6eaf0'],
        ['#8fa9f2', '#b9caf5', '#10151d'],
        ['#cbd8fa', '#e6ecfc', '#10151d'],
    ]),
});
// A module's share of its repo's changed lines (0..1) at which levels 1-4
// start: level 1 is any share above 0, the rest start at the share itself.
const HEAT_STEPS = Object.freeze([0, 0.05, 0.15, 0.4]);

function heatLevel(share) {
    const n = Number(share) || 0;
    if (!(n > 0)) return 0;
    let level = 1;
    for (const step of HEAT_STEPS.slice(1)) if (n >= step) level++;
    return level;
}

const LEGEND_H = 34;
const GLYPH = 16;

const categoryOf = (rec) => (rec && rec.kind === 'node' && typeof rec.icon === 'string' && rec.icon.startsWith(PREFIX)
    && Object.hasOwn(CATEGORIES, rec.icon.slice(PREFIX.length)) ? rec.icon.slice(PREFIX.length) : null);

// A copy of the doc to draw: a categorised node takes its category's fill and
// stroke where it set none, and loses `icon`, so Chartroom reserves no icon
// room (lib/chartroom/geometry/measure.js:8) — the glyph goes in the corner instead.
function prepare(doc) {
    const recs = Object.create(null);
    const cats = new Map();
    for (const [id, rec] of Object.entries(doc.recs)) {
        const cat = categoryOf(rec);
        if (!cat) { recs[id] = rec; continue; }
        const c = CATEGORIES[cat];
        const next = Object.assign({}, rec, { fill: rec.fill ?? c.tint, stroke: rec.stroke ?? c.color });
        delete next.icon;
        recs[id] = next;
        cats.set(id, cat);
    }
    return { doc: Object.assign({}, doc, { recs }), cats };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
const num = (v) => String(Math.round(v * 100) / 100);

function glyphAt(cat, x, y) {
    const c = CATEGORIES[cat];
    return `<g transform="translate(${num(x)} ${num(y)}) scale(${GLYPH / 24})" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.glyph}</g>`;
}

// The legend's row: one chip per category used, in CATEGORIES order, with its count.
const chipW = (cat) => 34 + CATEGORIES[cat].name.length * 14 + 22;
const countsOf = (cats) => {
    const counts = new Map();
    for (const cat of cats.values()) counts.set(cat, (counts.get(cat) || 0) + 1);
    return counts;
};

function legend(cats, x, y) {
    const counts = countsOf(cats);
    let at = x;
    const chips = [];
    for (const cat of Object.keys(CATEGORIES)) {
        if (!counts.has(cat)) continue;
        const c = CATEGORIES[cat];
        const w = chipW(cat);
        chips.push(`<g data-cat="${cat}"><rect x="${num(at)}" y="${num(y)}" width="${w}" height="24" rx="6" fill="${c.tint}" stroke="${c.color}"/>`
            + glyphAt(cat, at + 6, y + 4)
            + `<text x="${num(at + 28)}" y="${num(y + 16.5)}" font-size="12" fill="${THEME.text}">${esc(c.name)}</text>`
            + `<text x="${num(at + w - 14)}" y="${num(y + 16.5)}" font-size="12" font-weight="bold" fill="${c.color}">${counts.get(cat)}</text></g>`);
        at += w + 8;
    }
    return chips.join('');
}

// The drawn SVG with a glyph in each categorised node's top-right corner and
// the legend under the drawing, the viewBox grown by LEGEND_H to hold it and
// widened when the legend row is wider than a narrow drawing.
// `sc` is the scene the SVG was drawn from; its bounds are the unpadded ones.
function decorate(svg, sc, cats) {
    if (!cats.size) return svg;
    const glyphs = sc.items.filter((it) => it.type === 'node' && cats.has(it.id))
        .map((it) => `<g data-glyph-for="${esc(it.id)}">${glyphAt(cats.get(it.id), it.x + it.w - GLYPH - 8, it.y + 8)}</g>`);
    const b = sc.bounds;
    const row = [...countsOf(cats).keys()].reduce((sum, cat) => sum + chipW(cat) + 8, -8);
    const wide = (x, w) => num(Math.max(Number(w), (b.x - Number(x)) * 2 + row));
    let out = svg.replace(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/,
        (m, x, y, w, h, W, H) => `viewBox="${x} ${y} ${wide(x, w)} ${num(Number(h) + LEGEND_H)}" width="${wide(x, W)}" height="${num(Number(H) + LEGEND_H)}"`);
    out = out.replace(/(<rect x="([-\d.]+)" y="[-\d.]+" width=")([-\d.]+)(" height=")([-\d.]+)("[^>]*\/>)/,
        (m, a, x, w, c, h, z) => a + wide(x, w) + c + num(Number(h) + LEGEND_H) + z);
    return out.replace(/<\/svg>\n$/, glyphs.join('\n') + (glyphs.length ? '\n' : '')
        + `<g data-legend="">${legend(cats, b.x, b.y + b.h + 24 + 6)}</g>\n</svg>\n`);
}

module.exports = { CATEGORIES, THEME, PREFIX, HEAT, HEAT_STEPS, heatLevel, categoryOf, prepare, decorate };
