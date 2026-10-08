'use strict';
// Grades review.txt against the four defects planted in lib/cart.js, with the
// external bench's bar: at least three found, at most two findings that match
// none, and no made-up citation — a path not in the project, a line past its
// end, or a code-like backticked quote (one holding any of ()=<>[].;{}) found
// neither around the cited line nor in the file before the change. One made-up citation fails the whole review. A finding is
// a line that opens with `path:line:`, fankeel-reviewer's return format.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const proj = process.argv[2];
const planted = JSON.parse(fs.readFileSync(path.join(__dirname, 'planted.json'), 'utf8'));
const WINDOW = 2;
const squash = (s) => s.replace(/\s+/g, ' ').trim();

function readFile(rel) {
    try {
        return fs.readFileSync(path.join(proj, rel), 'utf8');
    } catch (e) {
        return null;
    }
}

function before(rel) {
    try {
        return execFileSync('git', ['-C', proj, 'show', 'HEAD~1:' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
        // A git failure is not the model's fabrication: say so, so a miss is not misread.
        console.error('git show HEAD~1:' + rel + ' failed: ' + String(e.message).split('\n')[0]);
        return '';
    }
}

function grade(text) {
    const found = new Set();
    let falsePositives = 0;
    const fabricated = [];
    for (const raw of text.split(/\r?\n/)) {
        const m = /^\s*(?:[-*]\s+)?`?((?:[A-Za-z]:)?[\w./\\-]+):(\d+)(?:-\d+)?`?:?\s/.exec(raw);
        if (!m) continue;
        let rel = m[1].replace(/\\/g, '/');
        if (/^[A-Za-z]:|^\//.test(rel)) rel = path.relative(proj, rel).replace(/\\/g, '/');
        rel = rel.replace(/^\.\//, '');
        const line = Number(m[2]);
        const body = readFile(rel);
        if (body === null) {
            fabricated.push(raw.trim() + ' — no such file');
            continue;
        }
        const lines = body.split(/\r?\n/);
        if (line < 1 || line > lines.length) {
            fabricated.push(raw.trim() + ' — past the end of ' + rel);
            continue;
        }
        const near = squash(lines.slice(Math.max(0, line - 1 - WINDOW), line + WINDOW).join(' '));
        const old = squash(before(rel));
        const quotes = [...raw.slice(m[0].length).matchAll(/`([^`]+)`/g)].map((q) => squash(q[1])).filter((q) => /[()=<>[\].;{}]/.test(q));
        const bad = quotes.filter((q) => !near.includes(q) && !old.includes(q));
        if (bad.length) {
            fabricated.push(raw.trim() + ' — `' + bad[0] + '` is not near line ' + line);
            continue;
        }
        let best = null;
        for (const d of planted.defects) {
            const dist = Math.abs(d.line - line);
            if (rel === planted.file && dist <= WINDOW && (!best || dist < best.dist)) best = { id: d.id, dist };
        }
        if (!best) falsePositives++;
        else found.add(best.id);
    }
    return { found: [...found], falsePositives, fabricated };
}

const text = readFile('review.txt');
if (text === null) {
    console.log('no review.txt');
    process.exit(1);
}
const g = grade(text);
const pass = g.found.length >= 3 && g.falsePositives <= 2 && g.fabricated.length === 0;
console.log(JSON.stringify(g));
process.exit(pass ? 0 : 1);
