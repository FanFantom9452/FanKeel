'use strict';
// The weekly report as one self-contained page (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 頁面區塊): the station's keel tokens and
// assets/weekly/report.css inline, every project's architecture drawn by
// lib/board.js, and the blocks of the approved mockup
// (.fankeel/build/2026-10-27-weekly-skill/mockup.html). No src=, no href=, no
// external font: the file is mailed as it is. `guard` runs before any of it —
// scripts/weekly.js refuses to write a page that carries an internal word.
const { renderBoard } = require('./board.js');
const { HEAT, HEAT_STEPS } = require('./board-look.js');

const BUILTIN_WORDS = ['session', 'gate', 'station', 'brain', 'TODO', 'subagent'];
const SHAPES = [
    ['$ 金額', /\$\s?\d/],
    ['UUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
];
// Identifiers, not prose: a module id may hold `station` and never shows as
// written, and a question id is only ever an attribute.
const SKIP = new Set(['modules', 'repo', 'id']);

const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'p';

function strings(v, where, out) {
    if (typeof v === 'string') out.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => strings(x, where + '[' + i + ']', out));
    else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) strings(x, where ? where + '.' + k : k, out);
    }
    return out;
}

function scan(pairs, words) {
    const tests = BUILTIN_WORDS.map((w) => [w, new RegExp('(?<![A-Za-z])' + reEsc(w) + 's?(?![A-Za-z])', 'i')])
        .concat(SHAPES)
        .concat((words || []).filter(Boolean).map((w) => [w, new RegExp(reEsc(w), 'i')]));
    const hits = [];
    for (const [where, text] of pairs) {
        for (const [word, re] of tests) if (re.test(text)) hits.push({ where, word });
    }
    return hits;
}

const guard = (events, words) => scan(strings(events, '', []), words);

// The data.json strings the page prints as text: a repo name, a frame name and
// a module name the model gave no label for (a label replaces it everywhere).
// Ids and paths never show, so they are not read.
function guardData(data, ev, words) {
    const pairs = [];
    (data.repos || []).forEach((r, i) => {
        const labels = (ev && ev.labels && ev.labels[r.name]) || {};
        pairs.push(['repos[' + i + '].name', String(r.name)]);
        ((r.modules && r.modules.mods) || []).forEach((m, j) => {
            const at = 'repos[' + i + '].modules.mods[' + j + '].';
            if (typeof m.frame === 'string') pairs.push([at + 'frame', m.frame]);
            if (typeof m.name === 'string' && !labels[m.id]) pairs.push([at + 'name', m.name]);
        });
    });
    return scan(pairs, words);
}

// ---- facets: the vocabulary a card is filed under, and who reads each one
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §2). The profile's
// weekly.facets replaces this list; scripts/weekly.js passes it as opts.facets.

const DEFAULT_FACETS = [
    { name: '商業／產品', audience: 'general' },
    { name: '文件／流程', audience: 'general' },
    { name: '使用者介面', audience: 'both' },
    { name: '研究／實驗', audience: 'both' },
    { name: '後端／資料', audience: 'tech' },
    { name: '維運／工具', audience: 'tech' },
];
const AUD = { general: 'gen', both: 'both', tech: 'tech' };
const AUD_NAME = { general: '一般', both: '兩者', tech: '技術' };
const AUD_ORDER = ['general', 'both', 'tech'];
const QID = /^[A-Za-z0-9_-]{1,40}$/;

// What the guard does not ask: every card has one or more facets from the
// vocabulary, `tech` is one to three sentences, and each question has a
// unique id the station can write a reply under. Same shape as guard's hits.
function shapeHits(events, facets) {
    const ev = normalise(events);
    const names = new Set((facets || DEFAULT_FACETS).map((f) => f.name));
    const hits = [];
    ev.events.forEach((e, i) => {
        const at = 'events[' + i + ']';
        const list = e && Array.isArray(e.facets) ? e.facets : [];
        if (!list.length) hits.push({ where: at + '.facets', word: '沒有面向' });
        list.forEach((f, j) => {
            if (!names.has(f)) hits.push({ where: at + '.facets[' + j + ']', word: '詞表外：' + f });
        });
        if (e && e.tech !== undefined && (typeof e.tech !== 'string' || !e.tech.trim() || (e.tech.match(/[。！？]/g) || []).length > 3)) {
            hits.push({ where: at + '.tech', word: '一到三句' });
        }
    });
    // The raw list, not ev.questions: normalise drops a non-object entry, and
    // a dropped question would vanish from the page without a word.
    const seen = new Set();
    (events && Array.isArray(events.questions) ? events.questions : []).forEach((q, i) => {
        const at = 'questions[' + i + ']';
        if (!q || typeof q !== 'object' || Array.isArray(q)) {
            hits.push({ where: at, word: '題目不是物件' });
            return;
        }
        if (!QID.test(String(q.id)) || seen.has(q.id)) hits.push({ where: at + '.id', word: '題號重複或不合格' });
        seen.add(q.id);
        if (typeof q.text !== 'string' || !q.text.trim()) hits.push({ where: at + '.text', word: '沒有題目' });
    });
    return hits;
}

// ---- tokens: the station's own values, so the report looks like the station

function blocks(css, selector) {
    const re = new RegExp('(?:^|[\\n}])\\s*' + reEsc(selector) + '\\s*\\{([^}]*)\\}', 'g');
    const out = [];
    let m;
    while ((m = re.exec(css))) out.push(m[1]);
    return out.join(';');
}

function decls(text) {
    const map = new Map();
    for (const part of text.split(';')) {
        const i = part.indexOf(':');
        if (i < 0) continue;
        const k = part.slice(0, i).trim();
        if (k.startsWith('--')) map.set(k, part.slice(i + 1).trim());
    }
    return map;
}

const joinDecls = (map) => [...map].map(([k, v]) => k + ':' + v).join(';');
const heatVars = (ramp) => ramp.map((h, n) => `--heat-${n}:${h.fill};--heat-${n}-line:${h.stroke};--heat-${n}-ink:${h.ink}`).join(';');

function tokens(stationCss) {
    const css = String(stationCss || '');
    const light = decls(blocks(css, ':root') + ';' + blocks(css, ':root[data-style=keel]'));
    const dark = decls(blocks(css, ':root[data-theme=dark]') + ';' + blocks(css, ':root[data-style=keel][data-theme=dark]'));
    const lightAll = joinDecls(light) + ';' + heatVars(HEAT.light);
    const darkAll = joinDecls(dark) + ';' + heatVars(HEAT.dark);
    return [
        ':root{color-scheme:light;' + lightAll + '}',
        '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;' + darkAll + '}}',
        ':root[data-theme="dark"]{color-scheme:dark;' + darkAll + '}',
        '@media print{:root,:root[data-theme="dark"],:root:not([data-theme="light"]){color-scheme:light;' + lightAll + ';--ground:' + (light.get('--panel') || '#ffffff') + '}}',
    ].join('\n');
}

// The drawn boards carry the light fills; each is mapped back to its level's tokens.
function heatRules() {
    return HEAT.light.map((h, n) => `.archmap .cr-shape[fill="${h.fill}"]{fill:var(--heat-${n});stroke:var(--heat-${n}-line)${n === 0 ? ';stroke-dasharray:4 3' : ''}}\n`
        + `.archmap g:has(> .cr-shape[fill="${h.fill}"]) text{fill:var(--heat-${n}-ink)}`).join('\n');
}

// ---- the events file, read leniently: a missing list is an empty one

function normalise(events) {
    const e = events && typeof events === 'object' ? events : {};
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    // A missing switch is off: a report shows the daily volume and its cost
    // only when the user picked them (design §1).
    const show = obj(e.show);
    return {
        projects: obj(e.projects), taglines: obj(e.taglines), summary: arr(e.summary), events: arr(e.events), architecture: obj(e.architecture), labels: obj(e.labels), carry: arr(e.carry), next: arr(e.next),
        show: { daily: show.daily === true, cost: show.cost === true },
        questions: arr(e.questions).filter((q) => q && typeof q === 'object' && !Array.isArray(q)),
    };
}

const projectsOf = (data, ev) => data.repos.filter((r) => r.commits > 0 || ev.events.some((e) => e.repo === r.name)).map((r) => r.name);

function relabel(board, labels) {
    if (!labels || !Object.keys(labels).length) return board;
    return board.split('\n').map((line) => {
        if (!line.trim()) return line;
        const r = JSON.parse(line);
        if (!r.node || typeof labels[r.node] !== 'string') return line;
        const i = r.shape === 'frame' ? -1 : String(r.label).indexOf('\n');
        r.label = labels[r.node] + (i >= 0 ? r.label.slice(i) : '');
        return JSON.stringify(r);
    }).join('\n');
}

// ---- blocks

const WD = ['日', '一', '二', '三', '四', '五', '六'];
const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const md = (d) => +d.slice(5, 7) + '/' + +d.slice(8, 10);
const commitLevel = (c) => (c === 0 ? 0 : c <= 15 ? 1 : c <= 50 ? 2 : c <= 100 ? 3 : 4);
const secHead = (n, id, title, lead) => `<div class="sec-h"><span class="sec-n">${n}</span><h2 id="${id}">${title}</h2><p class="lead">${lead}</p></div>`;
const VERDICT = { done: ['made', '做到'], partial: ['part', '部分'], not: ['missed', '沒做'] };

function header(data, ev, names, generated) {
    // A short pill: the name and the tagline. The long `projects` line is its tooltip.
    const chips = names.map((n) => {
        const tip = ev.projects[n] ? ` title="${esc(ev.projects[n])}"` : '';
        return `<li class="proj-chip"${tip}><b>${esc(n)}</b>${esc(ev.taglines[n] || '')}</li>`;
    }).join('\n');
    // The 一般／技術 switch, top right; hidden by report.css until report.js runs.
    return `<header class="report-head" data-block="header">
<div class="head-grid">
<div class="head-main">
<div class="title-row"><h1>工作週報</h1><p class="range">${esc(data.since)} 至 ${esc(data.until)}<small>共 ${data.days.length} 天</small></p></div>
<dl class="meta"><dt>產生日期</dt><dd class="mono">${esc(generated)}</dd><dt>涉及專案</dt><dd><ul>
${chips}
</ul></dd></dl>
</div>
<div class="aud" data-block="audience-toggle">
<div class="aud-row"><span class="aud-k" id="aud-k">內容深度</span>
<div class="seg" role="group" aria-labelledby="aud-k"><button type="button" data-aud="gen" aria-pressed="true">一般</button><button type="button" data-aud="tech" aria-pressed="false">技術</button></div></div>
<p class="aud-hint">一般：每件事的結論與理由。技術：每張卡再多一段做法、動到的模組與依據。</p>
</div>
</div>
</header>`;
}

function tally(carry) {
    const t = { done: 0, partial: 0, not: 0 };
    for (const c of carry) if (Object.prototype.hasOwnProperty.call(t, c.verdict)) t[c.verdict]++;
    return t;
}

function summary(ev, n, carried) {
    const items = ev.summary.map((s) => `<li class="story"><h3>${s.repo ? `<span class="who">${esc(s.repo)}</span>` : ''}${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('\n');
    const foot = carried ? `<p class="stories-foot">上一份週報列的 ${ev.carry.length} 項打算：<b>${carried.done} 項做到</b>、${carried.partial} 項做了一部分、${carried.not} 項沒做，見「上次的打算」。</p>` : '';
    return `<section data-block="summary" aria-labelledby="h-summary">
${secHead(n, 'h-summary', '本期重點', '這段期間的主線，各用一句話說明；細節在「做了哪些事」逐件列出。')}
<div class="panel"><ol class="stories">
${items}
</ol>${foot}</div>
</section>`;
}

function kpis(data, ev, names) {
    const done = ev.events.filter((e) => e.status === 'done').length;
    const ongoing = ev.events.length - done;
    const t = { A: 0, D: 0, files: 0, code: { a: 0, d: 0 }, doc: { a: 0, d: 0 }, data: { a: 0, d: 0 } };
    for (const r of data.repos) {
        t.A += r.modules.A;
        t.D += r.modules.D;
        t.files += r.modules.files;
        for (const k of ['code', 'doc', 'data']) { t[k].a += r.modules.byKind[k].a; t[k].d += r.modules.byKind[k].d; }
    }
    const pair = (k) => `<b>+${fmt(t[k].a)} −${fmt(t[k].d)}</b>`;
    return `<section class="panel kpis" data-block="kpis" aria-label="本期數字">
<div class="kpi"><div class="label">完成的事</div><div class="value">${done}<small>件</small></div></div>
<div class="kpi"><div class="label">進行中的事</div><div class="value">${ongoing}<small>件</small></div></div>
<div class="kpi"><div class="label">涉及專案</div><div class="value">${names.length}<small>個</small></div></div>
<div class="kpi change"><div class="label">改動量</div><div class="value"><span>+${fmt(t.A)}</span><span class="rm">−${fmt(t.D)}</span><small>行，${fmt(t.files)} 個檔案</small></div>
<p class="split"><span>程式與測試 ${pair('code')}</span><span>文件 ${pair('doc')}</span><span>資料與實驗輸出 ${pair('data')}</span></p></div>
</section>`;
}

function timeline(data, ev, n) {
    const head = data.days.map((d) => `<div class="day${[0, 6].includes(weekday(d)) ? ' weekend' : ''}" role="columnheader"><b>${+d.slice(8)}</b>${WD[weekday(d)]}</div>`).join('\n');
    const rows = data.repos.map((r) => {
        const cells = data.days.map((d) => {
            const c = r.daily[d] || 0;
            return `<div class="cell h${commitLevel(c)}" role="cell" aria-label="${md(d)} ${c} 次"><span class="d">${+d.slice(8)}<small>${WD[weekday(d)]}</small></span><b>${c}</b></div>`;
        }).join('\n');
        return `<div class="hrow" role="row"><div class="proj" role="rowheader"><b>${esc(r.name)}</b><span>${esc(ev.projects[r.name] || '')}</span></div>
<div class="cells">
${cells}
</div><div class="total" role="cell"><b>${fmt(r.commits)}</b><span> 次</span></div></div>`;
    }).join('\n');
    return `<section data-block="timeline" aria-labelledby="h-timeline">
${secHead(n, 'h-timeline', '每天的工作量', '每格是該專案當天提交程式的次數，顏色越深次數越多。')}
<div class="panel timeline-panel" role="table" aria-label="各專案每日程式提交次數">
<div class="hhead" role="row"><div class="corner" role="columnheader"></div>
${head}
<div class="head-total" role="columnheader">合計</div></div>
${rows}
<div class="legend" aria-hidden="true"><span><i class="h0"></i>沒有提交</span><span><i class="h1"></i>1 至 15 次</span><span><i class="h2"></i>16 至 50 次</span><span><i class="h3"></i>51 至 100 次</span><span><i class="h4"></i>超過 100 次</span></div>
</div>
</section>`;
}

async function architecture(data, ev, n) {
    // HEAT_STEPS are shares of the repo's code change: level 1 is above 0.
    const s = HEAT_STEPS;
    const pct = (x) => Math.round(x * 100) + '%';
    const legend = `<div class="legend arch-legend" aria-hidden="true"><span><i class="h0"></i>本期未改動</span>`
        + `<span><i class="h1"></i>不到 ${pct(s[1])}</span><span><i class="h2"></i>${pct(s[1])} 至 ${pct(s[2])}</span>`
        + `<span><i class="h3"></i>${pct(s[2])} 至 ${pct(s[3])}</span><span><i class="h4"></i>${pct(s[3])} 以上</span></div>`;
    const arts = [];
    for (const r of data.repos) {
        const labels = ev.labels[r.name] || {};
        const name = (m) => labels[m.id] || m.name;
        const svg = (await renderBoard(relabel(r.board, labels))).trim();
        const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(svg);
        const w = vb ? Math.round(Number(vb[1])) : 800;
        const mods = r.modules.mods;
        const rank = mods.filter((m) => m.level).sort((a, b) => (b.a + b.d) - (a.a + a.d)).slice(0, 5)
            .map((m) => `<li><span class="mod h${m.level}">${esc(name(m))}</span><span class="where">${esc(m.frame)}</span><span class="n mono">+${fmt(m.a)} −${fmt(m.d)}</span></li>`).join('\n');
        const id = 'h-arch-' + slug(r.name);
        arts.push(`<article class="panel arch" aria-labelledby="${id}">
<header class="arch-h"><h3 id="${id}">${esc(r.name)}<small>${esc(ev.projects[r.name] || '')}</small></h3><p class="tot"><span class="mono">+${fmt(r.modules.A)}</span> <span class="mono">−${fmt(r.modules.D)}</span> 行，<span class="mono">${fmt(r.modules.files)}</span> 個檔案</p></header>
<figure class="archmap" style="--w: ${w}px" role="img" aria-label="${esc(r.name)} 架構圖，依各模組占本期程式改動的比例上色">
${svg}
</figure>
<div class="arch-read"><p class="why">${esc(ev.architecture[r.name] || '')}</p>
<div><h4>改動最多的五個模組</h4><ol class="rank">
${rank}
</ol></div>
<p class="count">有改動的模組 <b>${mods.filter((m) => m.level).length} / ${mods.length}</b></p></div>
</article>`);
    }
    return `<section data-block="architecture" aria-labelledby="h-arch">
${secHead(n, 'h-arch', '這週改到哪裡', '把每個專案的結構畫成圖：每一格是一個模組，占這個專案程式改動的比例越高顏色越深，灰色虛線框是這期沒有動到的部分。每件事底下的色塊，就是圖上同名的模組。')}
${legend}
${arts.join('\n')}
</section>`;
}

// A card's facets in vocabulary order within each audience, general first;
// `i` is the facet's place in the vocabulary, the `f<i>` the filter reads.
function facetsOn(e, vocab) {
    const list = Array.isArray(e.facets) ? e.facets : [];
    return vocab.map((f, i) => Object.assign({ i }, f)).filter((f) => list.includes(f.name))
        .sort((a, b) => AUD_ORDER.indexOf(a.audience) - AUD_ORDER.indexOf(b.audience) || a.i - b.i);
}

// Evidence names records by date (紀錄 10-21、程式提交 1/1), the same dates
// show.daily keeps off the page: drop them and the separators they leave.
const DATED = /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}/g;
function undated(s) {
    return String(s || '').replace(DATED, '').replace(/[（(]\s*[)）]/g, '')
        .replace(/\s*[、,，]\s*(?=[、,，]|$)/g, '').replace(/^\s*[、,，]\s*|\s+[、,，]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function card(e, data, ev, vocab) {
    const repo = data.repos.find((r) => r.name === e.repo);
    const labels = ev.labels[e.repo] || {};
    const mods = (Array.isArray(e.modules) ? e.modules : [])
        // By id only: names repeat (every frame has a 其他), ids do not (Task 5).
        .map((key) => repo && repo.modules.mods.find((m) => m.id === key))
        .filter(Boolean);
    const chips = mods.length ? `<div class="mods"><span class="k">動到的模組</span><ul>${mods.map((m) => `<li class="mod h${m.level}">${esc(labels[m.id] || m.name)}</li>`).join('')}</ul></div>` : '';
    const done = e.status === 'done';
    const on = facetsOn(e, vocab);
    const tags = on.length ? `<ul class="facets" aria-label="面向">${on.map((f) => `<li class="facet a-${AUD[f.audience]}" title="${AUD_NAME[f.audience]}讀者">${esc(f.name)}</li>`).join('')}</ul>\n` : '';
    // The dates a piece of work ran are the daily volume by another name: off with it (design §1).
    const times = ev.show.daily && e.times ? `<span class="times">${esc(e.times)}</span>` : '';
    const evidence = ev.show.daily ? String(e.evidence || '') : undated(e.evidence);
    const tech = typeof e.tech === 'string' && e.tech.trim() ? `<p class="td-text"><span class="td-k">技術細節</span>${esc(e.tech)}</p>\n` : '';
    return `<li class="panel event" data-block="event-card" data-facets="${on.map((f) => 'f' + f.i).join(' ')}">
<div class="tags"><span class="proj-chip"><b>${esc(e.repo)}</b></span><span class="pill ${done ? 'done' : 'ongoing'}">${done ? '已完成' : '進行中'}</span>${times}</div>
<h4>${esc(e.title)}${Number(e.count) > 1 ? `<small> ×${Number(e.count)}</small>` : ''}</h4>
${tags}${e.point ? `<p class="point">${esc(e.point)}</p>` : ''}
<dl><dt>做了什麼</dt><dd>${esc(e.did)}</dd><dt>為什麼</dt><dd>${esc(e.why)}</dd><dt>下一步</dt><dd>${esc(e.next)}</dd></dl>
<div class="tech-detail" data-block="tech-detail">
${tech}${chips}
${evidence ? `<p class="evidence">依據：${esc(evidence)}</p>\n` : ''}</div>
</li>`;
}

// Only the facets some card carries this period, grouped by audience; each
// chip counts the cards carrying it, 全部 counts them all. report.js recounts
// per audience; without it the bar is hidden (report.css).
function facetBar(ev, vocab) {
    const count = (f) => ev.events.filter((e) => Array.isArray(e.facets) && e.facets.includes(f.name)).length;
    const groups = AUD_ORDER.map((aud) => {
        const chips = vocab.map((f, i) => ({ f, i, n: count(f) })).filter((x) => x.f.audience === aud && x.n)
            .map((x) => `<button type="button" class="fchip a-${AUD[aud]}" data-facet="f${x.i}" data-aud="${AUD[aud]}" aria-pressed="false">${esc(x.f.name)}<span class="n">${x.n}</span></button>`).join('');
        return chips ? `<span class="fgroup" data-aud="${AUD[aud]}"><span class="fg-k">${AUD_NAME[aud]}</span>${chips}</span>` : '';
    }).join('');
    return `<div class="facet-bar" data-block="facet-bar" role="group" aria-label="依面向篩選">
<span class="fb-k">依面向看</span>
<button type="button" class="fchip all" data-facet="all" aria-pressed="true">全部<span class="n">${ev.events.length}</span></button>
${groups}
<p class="fb-status" aria-live="polite">顯示全部 ${ev.events.length} 件</p>
</div>`;
}

function eventsSection(data, ev, n, vocab) {
    const done = ev.events.filter((e) => e.status === 'done');
    const ongoing = ev.events.filter((e) => e.status !== 'done');
    const group = (title, list) => (list.length ? `<h3 class="group-h">${title}<span class="count">${list.length}</span></h3>
<ul class="event-grid">
${list.map((e) => card(e, data, ev, vocab)).join('\n')}
</ul>` : '');
    return `<section data-block="events" aria-labelledby="h-events">
${secHead(n, 'h-events', '做了哪些事', `完成 ${done.length} 件、進行中 ${ongoing.length} 件。每張卡先一句結論，再分做了什麼、為什麼、下一步；「動到的模組」與架構圖同名同色。`)}
${ev.events.length ? facetBar(ev, vocab) : ''}
${group('已完成', done)}
${group('進行中', ongoing)}
</section>`;
}

function carrySection(data, ev, n, t) {
    const p = data.previous;
    const rows = ev.carry.map((c) => {
        const [cls, word] = VERDICT[c.verdict] || VERDICT.not;
        return `<div class="r" role="row"><span class="who" role="cell">${esc(c.repo)}</span><span class="said" role="cell">${esc(c.said)}</span>`
            + `<span class="res" role="cell"><span class="pill ${cls}">${word}</span></span><span class="now" role="cell"><span class="k">這次</span>${esc(c.now)}</span></div>`;
    }).join('\n');
    return `<section class="carry" data-block="carry" aria-labelledby="h-carry">
${secHead(n, 'h-carry', '上次的打算，這次做到沒', `上一份週報（<span class="mono">${esc(p.since)}</span> 至 <span class="mono">${esc(p.until)}</span>）列的下週打算，逐條對照這期的結果。`)}
<p class="carry-tally"><span><b>${t.done}</b>做到</span><span><b>${t.partial}</b>部分</span><span><b>${t.not}</b>沒做</span></p>
<div class="panel rows" role="table" aria-label="上一份週報的下週打算與這次的結果">
<div class="rh" role="row"><span role="columnheader">專案</span><span role="columnheader">上次說要做的</span><span role="columnheader">結果</span><span role="columnheader">這次的情況</span></div>
${rows}
</div>
</section>`;
}

function nextSection(ev, n) {
    const rows = ev.next.map((x) => `<div class="r"><span class="who">${esc(x.repo)}</span><span class="said">${esc(x.text)}</span></div>`).join('\n');
    return `<section class="next" data-block="next" aria-labelledby="h-next">
${secHead(n, 'h-next', '下週打算', '未完成的事與下週要做的事；下一份週報會逐條對照這裡。')}
<div class="panel rows">
${rows}
</div>
</section>`;
}

// A reply's save time as the page prints it, in this machine's time zone.
function stamp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (x) => String(x).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// The week's questions, read-only (design §3): each one's saved reply or
// 尚未回覆. The station redraws exactly this block when it saves a
// reply (lib/weekly-reply.js `redraw`), so it starts at
// `<section class="qs" data-block="questions"` and ends at a `\n</section>`
// of its own; the station's copy turns each `.q[data-q]` into an editor
// (assets/weekly/reply.js).
function questionsSection(questions, n) {
    const rows = questions.map((q) => {
        const ans = q.reply
            ? `<p class="ans">${esc(q.reply)}</p><p class="ans-meta">已存 <span class="mono">${esc(stamp(q.repliedAt))}</span></p>`
            : '<p class="ans none">尚未回覆</p>';
        return `<div class="q" role="listitem" data-q="${esc(q.id)}"><span class="q-who"><span class="proj-chip"><b>${esc(q.repo)}</b></span></span><div class="q-body"><p class="q-text">${esc(q.text)}</p>
<div class="q-reply"><span class="k">回覆</span>${ans}</div></div></div>`;
    }).join('\n');
    return `<section class="qs" data-block="questions" aria-labelledby="h-questions">
${secHead(n, 'h-questions', '本週想請教的問題', '想請老師回覆的事，每題下方是回覆欄。')}
<div class="panel q-list" role="list">
${rows}
</div>
</section>`;
}

function footer(data) {
    const withRecords = data.repos.filter((r) => r.records.length).map((r) => r.name);
    const gitOnly = data.repos.filter((r) => !r.records.length).map((r) => r.name);
    const range = `<span class="mono">${esc(data.since)}</span> 至 <span class="mono">${esc(data.until)}</span>`;
    const items = [];
    if (withRecords.length) items.push(`${esc(withRecords.join('、'))} 的完成紀錄，取 ${range} 的條目。`);
    items.push(`${data.repos.length} 個專案的程式提交紀錄，${range}${gitOnly.length ? `；${esc(gitOnly.join('、'))} 沒有完成紀錄，事項依提交主題分組整理` : ''}。`);
    items.push('改動量與架構圖：同一段提交紀錄逐檔加總的新增與刪除行數，只算程式與測試；文件與資料另列。模組依目錄劃分，有目錄地圖的專案依它，其餘取前兩層目錄。');
    if (data.repos.some((r) => r.sessions.length)) items.push('進行中工作的狀態紀錄，取期間內更新、尚未結束的項目。');
    if (data.previous) items.push(`上一份週報（<span class="mono">${esc(data.previous.since)}</span> 至 <span class="mono">${esc(data.previous.until)}</span>）列的下週打算。`);
    return `<footer class="report-foot" data-block="footer">
<h2>資料來源</h2>
<ol>
${items.map((i) => `<li>${i}</li>`).join('\n')}
</ol>
<p class="made">本頁由 fankeel 依上述紀錄整理，內容經本人確認。</p>
</footer>`;
}

// ---- 製作成本 (design §4): what producing this report spent, from
// lib/session-cost.js's figure for the session that ran render. The one block
// that prints money: it is drawn from that figure, never from events.json,
// so the guard over events.json stays as it is.

const MODEL = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(>100k)?$/;
function modelLabel(id) {
    const m = MODEL.exec(String(id));
    if (!m) return String(id);
    return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] ? '.' + m[3] : '') + (m[4] ? '（長提示）' : '');
}

function costSection(cost) {
    const c = cost || {};
    const models = Array.isArray(c.models) ? c.models : [];
    const write = (m) => (m.cacheWrite5m || 0) + (m.cacheWrite1h || 0);
    const total = models.reduce((t, m) => t + (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + write(m), 0);
    const usd = (x) => (typeof x === 'number' ? 'US$' + x.toFixed(2) : '未定價');
    // quota-share design §4: scripts/weekly.js's share of this session's account, or none.
    const pct = (p) => (typeof p === 'number' ? p + '%' : '—%');
    const s = c.share;
    const quota = s && (s.weekPct !== null || s.fiveHourPct !== null)
        ? `約佔週用量 ${pct(s.weekPct)}／5H ${pct(s.fiveHourPct)}（估算）`
        : '額度換算：量不到這個帳號的額度線';
    const rows = models.map((m) => `<div class="ct-r" role="row"><span class="m" role="rowheader">${esc(modelLabel(m.id))}</span>`
        + `<span role="cell"><i>input</i>${fmt(m.input)}</span><span role="cell"><i>output</i>${fmt(m.output)}</span>`
        + `<span role="cell"><i>cache 讀取</i>${fmt(m.cacheRead)}</span><span role="cell"><i>cache 寫入</i>${fmt(write(m))}</span>`
        + `<span role="cell"><i>API 等價</i>${usd(m.usd)}</span></div>`).join('\n');
    return `<aside class="cost" data-block="cost-footer" aria-labelledby="h-cost">
<h2 id="h-cost">製作成本</h2>
<p class="cost-sum">產生這份週報共用 <span class="mono">${fmt(total)}</span> tokens（<span class="mono">${fmt(c.requests)}</span> 次請求），依 API 公開價格換算約 <span class="mono">${usd(c.usd || 0)}</span>。</p>
<div class="cost-tbl" role="table" aria-label="依模型分列的 token 用量">
<div class="ct-h" role="row"><span role="columnheader">模型</span><span role="columnheader">input</span><span role="columnheader">output</span><span role="columnheader">cache 讀取</span><span role="columnheader">cache 寫入</span><span role="columnheader">API 等價</span></div>
${rows}
</div>
<p class="cost-quota">${quota}</p>
<p class="cost-src">價格取 ${esc(c.verified)} 讀到的 API 公開價目；實際以訂閱額度計。</p>
</aside>`;
}

async function render(data, events, opts) {
    const o = opts || {};
    const vocab = o.facets || DEFAULT_FACETS;
    const bad = shapeHits(events, vocab);
    if (bad.length) throw new Error('render refused: ' + bad.map((h) => h.where + ': ' + h.word).join('; '));
    const ev = normalise(events);
    const names = projectsOf(data, ev);
    const carried = data.previous && ev.carry.length ? tally(ev.carry) : null;
    let n = 0;
    const parts = [
        header(data, ev, names, o.generated || data.until),
        summary(ev, ++n, carried),
        kpis(data, ev, names),
    ];
    if (ev.show.daily) parts.push(timeline(data, ev, ++n));
    parts.push(await architecture(data, ev, ++n), eventsSection(data, ev, ++n, vocab));
    if (carried) parts.push(carrySection(data, ev, ++n, carried));
    parts.push(nextSection(ev, ++n));
    if (ev.questions.length) parts.push(questionsSection(ev.questions, ++n));
    parts.push(footer(data));
    if (ev.show.cost && o.cost) parts.push(costSection(o.cost));
    const script = o.reportJs ? `<script>\n${String(o.reportJs).trim()}\n</script>\n` : '';
    return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>工作週報 ${esc(data.since)} 至 ${esc(data.until)}</title>
<style>
${tokens(o.stationCss)}
${String(o.reportCss || '').trim()}
${heatRules()}
</style>
</head>
<body>
<main class="page" data-block="page" style="--days: ${data.days.length}">
${parts.join('\n\n')}
</main>
${script}</body>
</html>
`;
}

function archiveOf(data, events, generated) {
    const ev = normalise(events);
    const done = ev.events.filter((e) => e.status === 'done').length;
    return {
        since: data.since,
        until: data.until,
        generated,
        projects: projectsOf(data, ev),
        counts: { done, ongoing: ev.events.length - done },
        show: ev.show,
        events: ev.events,
        carry: ev.carry,
        next: ev.next,
        questions: ev.questions,
    };
}

module.exports = { BUILTIN_WORDS, DEFAULT_FACETS, guard, guardData, shapeHits, tokens, render, questionsSection, modelLabel, costSection, archiveOf };
