#!/usr/bin/env node
'use strict';
// design-lint: fails a mockup page on the excluded styles a stylesheet or
// markup can show. Only the page's own <style> and style="" are read, never a
// <link>ed project stylesheet. The rest of
// skills/fankeel-design/catalog/exclude.json is marked "review" and is the
// mockup agent's own self-review list.
const fs = require('node:fs');
const path = require('node:path');

const CATALOG = path.join(__dirname, '..', 'skills', 'fankeel-design', 'catalog', 'exclude.json');

// Top-level commas only: rgba(1,2,3,.5) stays one piece.
function splitTop(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function hue(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return { h: 0, s: 0 };
    const s = d / (1 - Math.abs(max + min - 1));
    let x;
    if (max === r) x = ((g - b) / d) % 6;
    else if (max === g) x = (b - r) / d + 2;
    else x = (r - g) / d + 4;
    return { h: (x * 60 + 360) % 360, s };
}

function px(t) {
    const m = /^(-?[\d.]+)(px)?$/.exec(t);
    return m ? Number(m[1]) : null;
}

// Each shadow as offsets and blur; colour words and functions dropped.
function shadows(value) {
    return splitTop(value).map((one) => {
        const nums = one.replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]+/gi, ' ').split(/\s+/).map(px).filter((n) => n !== null);
        return { inset: /\binset\b/.test(one), x: nums[0], y: nums[1], blur: nums[2] || 0, coloured: /rgba?\(|hsla?\(|#/.test(one) };
    }).filter((s) => s.x !== undefined && s.y !== undefined);
}

function decls(body) {
    return body.split(';').map((d) => d.split(':')).filter((p) => p.length > 1)
        .map(([p, ...v]) => [p.trim().toLowerCase(), v.join(':').trim()]);
}

// [{ sel, decls: [[prop, value]] }] from every <style> block and style="" attribute.
function rules(html) {
    const out = [];
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
        for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: r[1].trim(), decls: decls(r[2]) });
    }
    for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) out.push({ sel: '[style]', decls: decls(m[1]) });
    return out;
}

function text(html) {
    return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

const RULES = {
    'gradient-text': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /background-clip$/.test(p) && /\btext\b/.test(v)).map(() => r.sel)),
    'purple-gradient': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^background/.test(p) && /gradient\(/.test(v)
        && (v.match(/#[0-9a-f]{3,6}\b/gi) || []).some((c) => { const { h, s } = hue(c); return h >= 240 && h <= 300 && s > 0.4; })).map(() => r.sel)),
    glow: (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^(box|text)-shadow$/.test(p)
        && shadows(v).some((s) => !s.inset && s.x === 0 && s.y === 0 && s.blur >= 8 && s.coloured)).map(() => r.sel)),
    'hard-shadow': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'box-shadow'
        && shadows(v).some((s) => (s.x !== 0 || s.y !== 0) && s.blur === 0)).map(() => r.sel)),
    'side-stripe': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^border-(left|right|inline-start|inline-end)(-width)?$/.test(p)
        && (px(v.split(/\s+/)[0]) || 0) > 1).map(() => r.sel)),
    'caps-label': (rs) => rs.filter((r) => r.decls.some(([p, v]) => p === 'text-transform' && v === 'uppercase')
        && r.decls.some(([p, v]) => p === 'letter-spacing' && !/^(0|normal)/.test(v))).map((r) => r.sel),
    glass: (rs) => rs.filter((r) => r.decls.some(([p]) => /backdrop-filter$/.test(p))
        && !r.decls.some(([p, v]) => p === 'position' && v === 'fixed')).map((r) => r.sel),
    'small-text': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'font-size' && /px$/.test(v) && px(v) < 12).map(([, v]) => r.sel + ' ' + v)),
    'pure-bw': (rs) => rs.flatMap((r) => r.decls.filter(([, v]) => /#(fff|ffffff|000|000000)\b/i.test(v)).map(([p, v]) => r.sel + ' ' + p + ':' + v)),
    'transition-all': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'transition' && /^all\b/.test(v)).map(() => r.sel)),
    'font-families': (rs) => {
        const fams = new Set(rs.flatMap((r) => r.decls.filter(([p]) => p === 'font-family')
            .map(([, v]) => v.split(',')[0].replace(/["']/g, '').trim().toLowerCase())));
        return fams.size > 3 ? [[...fams].join(', ')] : [];
    },
    'accent-overuse': (rs) => {
        const users = rs.filter((r) => r.decls.some(([p, v]) => !p.startsWith('--') && /var\(--accent/.test(v))).map((r) => r.sel);
        return users.length > 1 ? users : [];
    },
    emoji: (_rs, html) => text(html).match(/\p{Extended_Pictographic}/gu) || [],
    filler: (_rs, html) => text(html).match(/\blorem ipsum\b|\bacme\b|\bjohn doe\b/gi) || [],
};

function lint(html, catalog) {
    const rs = rules(html);
    const byRule = {};
    for (const e of (catalog && catalog.items) || []) if (e.check !== 'review') (byRule[e.check] = byRule[e.check] || []).push(e.id);
    const hits = [];
    for (const [id, fn] of Object.entries(RULES)) {
        for (const where of fn(rs, html)) hits.push({ rule: id, catalog: (byRule[id] || ['-']).join(','), where });
    }
    return hits;
}

module.exports = { lint, RULES };

if (require.main === module) {
    const file = process.argv[2];
    if (!file) { console.error('usage: design-lint.js <page.html>'); process.exit(2); }
    const catalog = fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, 'utf8')) : null;
    const hits = lint(fs.readFileSync(file, 'utf8'), catalog);
    for (const h of hits) console.log(h.rule + '  ' + h.catalog + '  ' + h.where);
    console.log(hits.length ? 'design-lint: ' + hits.length + ' hit(s)' : 'design-lint: clean');
    process.exit(hits.length ? 1 : 0);
}
