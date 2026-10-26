'use strict';
// lib/settingsuggest.js — the 快速設定 page's preselected answers (station-39).
// Every one of the ten questions gets an option value `o` and where it came
// from: `rec` (依你的紀錄) when this project's git log, its registry or a
// profile file already says something, `author` (作者推薦) when nothing does.
// `v` carries the figures the page may quote. Reads only; writes nothing.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const profile = require('./profile.js');
const registry = require('./registry.js');
const { trackedFiles, posix } = require('./tracked.js');
const { FULL_ROUTE } = require('./stages.js');

const DAY = 24 * 3600e3;
const WINDOW_MS = 90 * DAY;            // sessions older than this say little about today's habit
const FRONT = /\.(html|css|vue|svelte|jsx|tsx)$/i;
const AUTHOR = { main: 'merge', push: 'false', sessions: 'some', inflight: '8', ctx: 'rw', lang: 'en', gates: 'survey', floor: 'sonnet', screen: 'opus', where: 'term' };
const GATES = { bounded: 'bounded', architectural: 'arch' };

const rec = (o, v) => ({ o: String(o), src: 'rec', v: v || {} });
const author = (q) => ({ o: AUTHOR[q], src: 'author', v: {} });
const isSet = (prof, key) => Boolean(prof.sources[key]) && prof.sources[key] !== 'builtin';

// Peak number of sessions open at once, and the share of the time any was
// open that two or more were. A session that ends as another starts does not overlap it.
function overlap(spans) {
    const ev = [];
    for (const [a, b] of spans) ev.push([a, 1], [b, -1]);
    ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let open = 0;
    let peak = 0;
    let busy = 0;
    let crowded = 0;
    let last = null;
    for (const [t, d] of ev) {
        if (last !== null && open >= 1) busy += t - last;
        if (last !== null && open >= 2) crowded += t - last;
        open += d;
        last = t;
        peak = Math.max(peak, open);
    }
    return { peak, share: busy ? crowded / busy : 0 };
}

function spansOf(entries, now) {
    const out = [];
    for (const e of entries) {
        const a = Date.parse(e.data.started);
        const b = Date.parse((e.data.ended && e.data.ended.at) || e.data.updated);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b < now - WINDOW_MS) continue;
        out.push([a, b]);
    }
    return out;
}

// stage.agents as parsed: an array of stage names.
function ctxOf(list) {
    if (!Array.isArray(list) || !list.length) return 'none';
    return list.length >= FULL_ROUTE.length ? 'all' : 'rw';
}

function mostOf(words) {
    const tally = {};
    for (const w of words) tally[w] = (tally[w] || 0) + 1;
    return Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
}

// profile.suggest offers only the types the log used (the 2026-10-02 plan
// gate); the page offers them with `merge` added, or scripts/land.js's own
// merge subject would fail the pattern.
function withMerge(candidate) {
    const m = /^\^\(([^)]*)\)/.exec(String(candidate || ''));
    if (!m) return null;
    const types = [...new Set(m[1].split('|').concat('merge'))].sort();
    return '^(' + types.join('|') + ')' + candidate.slice(m[0].length);
}

// profile.suggest's evidence gives this count only when a remote exists; with
// none, every commit is unpushed, so count it here.
function unpushed(dir) {
    try {
        const out = execFileSync('git', ['log', '--oneline', '--branches', '--not', '--remotes'], { windowsHide: true, cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return out.split('\n').filter(Boolean).length;
    } catch (_) {
        return null;
    }
}

function suggestFor(projectDir, registryRoot, configDir, now) {
    const s = profile.suggest(projectDir, registryRoot);
    const merged = profile.read(projectDir, configDir);
    const machine = profile.read(null, configDir).values;
    const ev = s.evidence.join('\n');
    const num = (re) => {
        const m = re.exec(ev);
        return m ? Number(m[1]) : null;
    };
    const rel = registryRoot ? posix(path.relative(registryRoot, projectDir)) : '';
    const entries = registryRoot ? registry.readAll(registryRoot).entries.filter((e) => registry.projectOf(e.data) === rel) : [];
    const listed = trackedFiles(projectDir);
    const front = fs.existsSync(path.join(projectDir, '.fankeel', 'render.json')) || Boolean(listed && listed.files.some((f) => FRONT.test(f)));
    const recs = {};

    const integ = s.values['land.integration'];
    recs.main = integ ? rec(integ, { local: num(/merges: (\d+) local/), pr: num(/, (\d+) pull request/) }) : author('main');

    const push = s.values['land.push'];
    recs.push = push === undefined ? author('push') : rec(push, { unpushed: unpushed(projectDir) });

    const spans = spansOf(entries, now);
    if (spans.length >= 5) {
        const o = overlap(spans);
        const word = o.share >= 0.5 || o.peak >= 4 ? 'many' : o.peak >= 2 ? 'some' : 'one';
        recs.sessions = rec(word, { peak: o.peak, share: Math.round(o.share * 100), n: spans.length });
    } else {
        recs.sessions = author('sessions');
    }

    if (isSet(merged, 'dispatch.inflight')) {
        // The wizard's slider has a stop for every value the key accepts, so the answer is the value itself.
        const n = merged.values['dispatch.inflight'];
        recs.inflight = rec(n, { now: n });
    } else {
        recs.inflight = author('inflight');
    }

    // The profile snapshot task.js writes on each record holds stage.agents
    // only when somebody set it, so three snapshots are three choices.
    const snaps = entries.map((e) => e.data.profile && e.data.profile['stage.agents']).filter(Array.isArray);
    if (isSet(merged, 'stage.agents')) recs.ctx = rec(ctxOf(merged.values['stage.agents']), { from: 'profile' });
    else if (snaps.length >= 3) recs.ctx = rec(mostOf(snaps.map(ctxOf)), { from: 'tasks', n: snaps.length });
    else recs.ctx = author('ctx');

    const lang = merged.values['model.lang'];
    if (lang) recs.lang = rec(/中|zh|chinese/i.test(lang) ? 'zh' : /^(en|english)$/i.test(lang) ? 'en' : 'other', { lang });
    else if (machine['ui.lang'] === 'zh') recs.lang = rec('zh', { from: 'ui.lang' });
    else recs.lang = author('lang');

    const cls = s.values['class.default'] || (isSet(merged, 'class.default') ? merged.values['class.default'] : null);
    recs.gates = GATES[cls] ? rec(GATES[cls], { cls }) : author('gates');

    const floor = merged.values['dispatch.floor'];
    recs.floor = isSet(merged, 'dispatch.floor') ? rec(floor === 'haiku' || floor === 'sonnet' ? floor : 'opus', { floor }) : author('floor');

    const mock = merged.values['design.mockup'];
    if (isSet(merged, 'design.mockup')) recs.screen = rec(mock === false || mock === 'false' ? 'false' : mock === 'auto' ? 'auto' : 'opus', { mockup: String(mock) });
    else recs.screen = front ? author('screen') : { o: 'false', src: 'author', v: {} };

    const wait = String(merged.values['gate.station']);
    if (isSet(merged, 'gate.station') && !/^(off|false|0)$/.test(wait)) recs.where = rec('station', { wait });
    else if (isSet(merged, 'gate.away') && merged.values['gate.away'] === 'hint') recs.where = rec('term', { from: 'gate.away' });
    else recs.where = author('where');

    return { front, recs, commitFormat: withMerge(s.values['commit.format']) };
}

module.exports = { suggestFor };
