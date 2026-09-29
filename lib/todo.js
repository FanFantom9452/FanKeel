'use strict';

// TODO entries, and the one reader every consumer shares.
//
// A project whose `.fankeel/docs.json` declares a bucket with role `todo`, and
// has that folder, keeps one file per entry there and a `TODO.md` generated
// from them. A project that does not keeps a hand-written `TODO.md`. `load`
// reads either and returns the shapes `entries()` and `timings()` give for the
// hand-written file, so orient, todo-check and the station compute what they
// computed before. Design: docs/90-agent/plans/2026-09-29-todo-files-design.md.
//
// The text readers below moved here from `scripts/todo-check.js` unchanged:
// nothing in `lib/` may require `scripts/`, and the station needs them.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('./docs.js');
const { width } = require('./handoff.js');

// Long enough for a sentence and a link, short enough that a paragraph does not
// fit. Detail that will not compress to this belongs in the file being pointed
// at, which is the whole rule.
const MAX_ENTRY_CHARS = 200;

// The three buckets, in the order a reader wants them: what can be started now,
// what needs a person before anyone can start, what nobody can move yet. The
// heading carries the classification, so it costs one line of structure per group
// rather than a field on every bullet — and `entries()` was already recording it
// while nothing read it back.
//
// By decision state and not by topic, on purpose. Topic groups read well and
// answer the wrong question: what `init` needs to know is which entries can
// become a task today, and two bullets about one file are as often one that is
// ready and one that is still an argument.
const SECTIONS = ['Ready', 'Needs a decision', 'Blocked', 'Watch'];

// Under these two a `###` is a timing, not a heading, and each takes its own
// conditions. `Waiting` is the heading both replaced on 2026-09-27: a `###`
// under it still groups (so its entries report as unclassified under
// "Waiting", not under the timing's title), and it is never spared as another
// vocabulary.
const TIMED = ['Blocked', 'Watch'];

const RETIRED = 'Waiting';

// A Watch timing is never due: nobody can check its event. What can go stale
// is the decision to keep watching, and sixty days is when it is asked again.
const STALE_DAYS = 60;

// Seven days, and it is a re-read interval rather than an age.
//
// `## Waiting` has shrunk five times in this repository's history — c50a5d5,
// a62863e, 811219c, 3fadc08 and 0004ad5. Four were somebody re-reading the
// section and finding an entry misfiled, and one a question Claude Code's docs
// answered first; none of the five was the thing it named actually happening.
// On 2026-09-18 two did leave that way (cdb240e), and both were found by
// somebody reading the section. It is drained by being read, so the interval
// to measure is the one between readings.
//
// Seven and not the fortnight the documentation sweep runs on, because the
// fortnight caught nothing: on 2026-09-01 the four oldest entries had sat
// eleven days untouched and a fourteen-day window would have reported none of
// them. A window that misses the backlog it was written for is the wrong
// window. Seven reports those four and the one behind them, which is the set
// that prompted this.
const REREAD_DAYS = 7;

// `MM-DD` at the end of the entry, which is what twelve of the sixteen entries
// already carried before anything read them back. No year: it is written by
// hand, and a year is noise 364 days out of 365.
const STAMP = /(?:^|\s)(\d{2})-(\d{2})\.?$/;

// The condition line: a key naming the kind of wait, then what it waits for,
// then the stamp. Anchored at the start of the line — a key buried mid-sentence
// is prose, not a condition. The stamp is stripped off the tail the same way
// `STAMP` finds it. What this cannot do: grade whether the text names anything
// real. `after: it seems worth revisiting.` passes.
const CONDITION = /^(on|after|upstream|if):\s*(.*)$/i;

function conditionAt(text) {
    const m = CONDITION.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const event = m[2].replace(STAMP, '').trim().replace(/\.$/, '').trim();
    return { kind: m[1].toLowerCase(), event: event || null };
}

// A timing's title, in terminal columns rather than characters. A CJK or
// full-width character takes two, so a cap in characters would let a Chinese
// title run twice as wide as an English one. 28 is fourteen Chinese characters
// or twenty-eight letters — the arithmetic AskUserQuestion's header already
// uses, twelve characters or six in CJK.
const MAX_TITLE_WIDTH = 28;

function mmdd(t) {
    const d = new Date(t);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// An event that opens with `MM-DD` is a date, and its timing is due from that
// day rather than a week after its stamp — the one kind of event a script can
// judge. The day is the first one on or after the stamp: a `01-05` stamped
// `12-20` is next January.
const DATE = /^(\d{2})-(\d{2})(?!\d)/;

function dateAt(event, stamped) {
    const m = event === null ? null : DATE.exec(event);
    if (!m || stamped === null) return null;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = new Date(stamped).getFullYear();
    for (const y of [year, year + 1]) {
        const at = new Date(y, month - 1, day);
        if (at.getMonth() !== month - 1 || at.getDate() !== day) continue;
        if (at.getTime() >= stamped) return at.getTime();
    }
    return null;
}

// Whether the day arithmetic slips a day across a DST transition is untested.
// It matches `docs-audit.js`'s `daysBetween`, and every machine this has run on
// keeps one offset all year, so there has been nothing to observe rather than
// something observed and dismissed.
//
// The most recent `MM-DD` that is not in the future. Read on 5 January, a
// `12-15` is three weeks back and not eleven months forward, and that rollover
// is the only case where a missing year can be got wrong.
function stampAt(text, now) {
    const m = STAMP.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = new Date(now).getFullYear();
    for (const y of [year, year - 1]) {
        const at = new Date(y, month - 1, day);
        // A month that rolled over is not a date in *this* year, which is not
        // the same as not being a date. `02-29` is both: invalid in 2025 and
        // the right answer in 2024, so the next candidate still has to be
        // tried. Returning here read a valid leap-day stamp as no stamp at all
        // and failed the run on it.
        if (at.getMonth() !== month - 1 || at.getDate() !== day) continue;
        if (at.getTime() <= now) return at.getTime();
    }
    return null;
}

// A deleted entry leaves no record of what happened to it, and a nobody-said
// deletion is the same failure `entries()` already catches for a stray
// heading — one step earlier. `docs/90-agent/reference/todo-completions.md`
// is where the record goes; this page's own role (`reference`) is never
// checked here, only its content.
const COMPLETIONS_PAGE = 'docs/90-agent/reference/todo-completions.md';

const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
// A scheme, or a bare in-page anchor. Neither is a file in this repository, so
// neither is something this can check.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

// Top-level bullets only. An indented bullet is a continuation of the entry
// above it and is measured as part of it, not as an entry of its own.
//
// `end` is the last line actually folded into the entry — its own bullet line
// until a continuation line extends it — not the line before whatever comes
// next in the file. A caller wanting "this entry's lines, however many it
// wraps over" needs that distinction: the gap between one entry and the next
// can hold a blank line, or the heading that opens the following section, and
// neither belongs to the entry that happens to sit above it.
function entries(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    let current = null;
    const close = () => {
        if (current) out.push(current);
        current = null;
    };
    let timing = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line)) {
            close();
            // Under `## Blocked` or `## Watch` a `###` is a timing, not a
            // section: the entries below it wait for the same thing and lift
            // together. Under the retired `## Waiting` it groups too, so its
            // entries are reported under "Waiting". Anywhere else it is a
            // heading like any other, and still unclassified.
            if (/^#{3,6}\s/.test(line) && (TIMED.includes(section) || section === RETIRED)) {
                timing = i + 1;
                continue;
            }
            section = line.replace(/^#+\s*/, '').trim();
            timing = null;
            continue;
        }
        if (/^[-*]\s+\S/.test(line)) {
            close();
            current = { line: i + 1, end: i + 1, section, timing, text: line.replace(/^[-*]\s+/, '') };
            continue;
        }
        if (current && /^\s+\S/.test(line)) {
            current.text += ' ' + line.trim();
            current.end = i + 1;
            continue;
        }
        if (!line.trim()) continue;
        close();
    }
    close();
    return out;
}

function linksIn(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const target = m[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
        if (!target || EXTERNAL.test(target)) continue;
        out.push(target.split('#')[0]);
    }
    return out;
}

// Every `###` under `## Blocked` or `## Watch`, with the line after it read as
// its condition: the kind of wait, what it waits for, and the day somebody last
// agreed it still does. The first non-blank line is taken whatever it says, so
// a line with a stamp and no key is `unconditioned` rather than `undated` too.
// Blocked is due — `on:` from its date, the others seven days after the stamp;
// Watch is never due and goes stale sixty days after the stamp.
function timings(text, now) {
    const at = now === undefined ? Date.now() : now;
    const lines = text.split(/\r?\n/);
    const found = entries(text);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && (TIMED.includes(section) || section === RETIRED)) {
            if (section === RETIRED) continue;
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            const next = j < lines.length && !/^#{1,6}\s|^[-*]\s/.test(lines[j]) ? lines[j] : '';
            const cond = next ? conditionAt(next) : null;
            const kind = cond ? cond.kind : null;
            const event = cond ? cond.event : null;
            const stamp = next ? stampAt(next, at) : null;
            const date = kind === 'on' ? dateAt(event, stamp) : null;
            const days = stamp === null ? null : Math.floor((at - stamp) / 86400000);
            const watch = section === 'Watch';
            const due = watch ? false : date !== null ? at >= date : days !== null && days >= REREAD_DAYS;
            const stale = watch && days !== null && days >= STALE_DAYS;
            out.push({ line: i + 1, section, title: h[2].trim(), kind, event, stamp, date, days, due, stale,
                items: found.filter((e) => e.timing === i + 1) });
            continue;
        }
        section = h[2].trim();
    }
    return out;
}

// ---- entry files -----------------------------------------------------------

// The five states an entry file can carry, and the heading each open one is
// filed under in the generated index.
const STATES = ['ready', 'decision', 'blocked', 'watch', 'done'];
const HEADING = { ready: SECTIONS[0], decision: SECTIONS[1], blocked: SECTIONS[2], watch: SECTIONS[3] };
const STATE_OF = { [SECTIONS[0]]: 'ready', [SECTIONS[1]]: 'decision', [SECTIONS[2]]: 'blocked', [SECTIONS[3]]: 'watch' };
const DISPOSITIONS = ['done', 'measured-no-change', 'abandoned'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[0-9a-f]{7,40}$/;
const FRONT = /^---\r?\n[\s\S]*?\r?\n---\r?(?:\n|$)/;
// The contract that used to be TODO.md's own preamble; the generated preamble
// links it where the project has it.
const CONTRACT_PAGE = 'docs/90-agent/reference/todo.md';

function isoDay(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// The declared bucket, whether or not the folder exists yet: `migrate` makes it.
function bucketPath(root) {
    const { tree } = docs.read(root);
    const b = tree ? tree.buckets.find((x) => x.role === 'todo') : null;
    return b ? b.path : null;
}

// Folder mode is a declared bucket whose folder exists. Either missing is
// TODO.md mode, the rules a project had before this.
function folderOf(root) {
    const rel = bucketPath(root);
    if (!rel) return null;
    try {
        return fs.statSync(path.join(root, rel)).isDirectory() ? rel : null;
    } catch (e) {
        return null;
    }
}

// `docs.frontmatter` reads `done:`'s indented fields as `done.at` and so on.
function parse(text) {
    const fm = docs.frontmatter(text) || {};
    const m = FRONT.exec(text);
    const body = (m ? text.slice(m[0].length) : text).trim();
    const done = fm['done.at'] || fm['done.sha'] || fm['done.disposition']
        ? { at: fm['done.at'] || '', sha: fm['done.sha'] || '', disposition: fm['done.disposition'] || '', session: fm['done.session'] || '' }
        : null;
    return {
        label: fm.label || '', title: fm.title || '', description: fm.description || '', state: fm.state || '',
        link: fm.link || '', group: fm.group || '', timing: fm.timing || '', stamp: fm.stamp || '', done, body,
    };
}

function serialize(e) {
    const lines = ['---'];
    const put = (key, value) => {
        const v = String(value || '').replace(/\s+/g, ' ').trim();
        if (v) lines.push(key + ': ' + v);
    };
    put('label', e.label);
    put('title', e.title);
    put('description', e.description);
    put('state', e.state);
    put('link', e.link);
    put('group', e.group);
    put('timing', e.timing);
    put('stamp', e.stamp);
    if (e.done) {
        lines.push('done:');
        for (const k of ['at', 'sha', 'disposition', 'session']) if (e.done[k]) lines.push('  ' + k + ': ' + e.done[k]);
    }
    lines.push('---');
    const body = String(e.body || '').trim();
    return lines.join('\n') + '\n' + (body ? '\n' + body + '\n' : '');
}

const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });

function readFolder(root, folder) {
    let names;
    try {
        names = fs.readdirSync(path.join(root, folder));
    } catch (e) {
        // A folder that is not there holds nothing. Anything else (a file where
        // the folder should be, no permission) is not "empty": returning [] would
        // let writeIndex and add rewrite TODO.md from nothing.
        if (e && e.code === 'ENOENT') return [];
        throw e;
    }
    return names.filter((n) => n.endsWith('.md')).map((n) => Object.assign(
        { id: n.slice(0, -3), file: folder + '/' + n },
        parse(fs.readFileSync(path.join(root, folder, n), 'utf8')),
    )).sort(byId);
}

function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// `<label>-<n>`, one past the highest `n` that label has in `list`.
function newId(list, label) {
    const base = slug(label) || 'entry';
    const re = new RegExp('^' + base + '-(\\d+)$');
    let n = 0;
    for (const e of list) {
        const m = re.exec(e.id);
        if (m) n = Math.max(n, Number(m[1]));
    }
    return base + '-' + (n + 1);
}

// A title out of a description: its first clause, markdown dropped, cut to
// fit MAX_TITLE_WIDTH with an ellipsis.
function titleOf(text) {
    const plain = String(text || '').replace(/^〔[^〕]*〕/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`/g, '').replace(/\s+/g, ' ').trim();
    const head = plain.split(/：| — |: /)[0].trim() || plain;
    let out = '';
    for (const c of head) {
        if (width(out + c) > MAX_TITLE_WIDTH - 1) return out.trim() + '…';
        out += c;
    }
    return out;
}

// One line in TODO.md's shape — an optional `〔label〕`, then the text — as the
// fields of an entry. The station's 記成 TODO and `migrate` both come here.
function fromLine(text, link, state) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const m = /^〔([^〕]+)〕\s*/.exec(t);
    const description = m ? t.slice(m[0].length) : t;
    return { label: m ? m[1] : '', title: titleOf(description), description, state, link: String(link || '').trim() };
}

// The bullet the index prints: the label, the description, and the link
// unless the description already carries it. Never empty — an empty bullet is
// no entry to `entries()`, and `load` pairs bullets with files by position.
function bulletOf(e) {
    const link = e.link && !e.description.includes('](' + e.link)
        ? ' — [' + (e.link.split('#')[0].split('/').pop() || e.link) + '](' + e.link + ').'
        : '';
    return ((e.label ? '〔' + e.label + '〕' : '') + e.description + link).trim() || e.id;
}

function preamble(root, folder) {
    const out = [
        'Generated by fankeel\'s `scripts/todo.js index` from `' + folder + '/`, one file per',
        'entry: change them with `todo.js new` and `todo.js done`, never this file —',
        '`todo-check` refuses a TODO.md that differs from what `index` writes.',
    ];
    if (fs.existsSync(path.join(root, CONTRACT_PAGE))) {
        out.push('', 'What each heading means and what `/fankeel` does with it: [todo.md](' + CONTRACT_PAGE + ').');
    }
    return out;
}

// The generated TODO.md: the four headings always, open entries by id under
// their state's heading, Blocked and Watch entries under one `### <group>` per
// group and timing, whose next line is the timing and the oldest stamp as
// MM-DD. An entry with a state outside the five is not printed; todo-check
// names it. `order` is the ids in bullet order.
function render(root, list, folder) {
    const open = list.filter((e) => e.state !== 'done');
    const out = ['# TODO', '', ...preamble(root, folder), ''];
    const order = [];
    const bullet = (e) => {
        order.push(e.id);
        return '- ' + bulletOf(e);
    };
    for (const state of ['ready', 'decision']) {
        out.push('## ' + HEADING[state], '');
        for (const e of open.filter((x) => x.state === state)) out.push(bullet(e), '');
    }
    for (const state of ['blocked', 'watch']) {
        out.push('## ' + HEADING[state], '');
        const mine = open.filter((x) => x.state === state);
        const loose = mine.filter((e) => !e.group);
        for (const e of loose) out.push(bullet(e));
        if (loose.length) out.push('');
        const groups = [];
        for (const e of mine.filter((x) => x.group)) {
            const key = e.group + '\n' + (e.timing || '');
            let g = groups.find((x) => x.key === key);
            if (!g) {
                g = { key, group: e.group, timing: e.timing || '', items: [] };
                groups.push(g);
            }
            g.items.push(e);
        }
        for (const g of groups) {
            const stamps = g.items.map((e) => e.stamp).filter((s) => ISO.test(s)).sort();
            const cond = [g.timing ? g.timing.replace(/\.$/, '') + '.' : '', stamps.length ? stamps[0].slice(5) + '.' : '']
                .filter(Boolean).join(' ');
            out.push('### ' + g.group);
            if (cond) out.push(cond);
            out.push('');
            for (const e of g.items) out.push(bullet(e));
            out.push('');
        }
    }
    while (out[out.length - 1] === '') out.pop();
    return { text: out.join('\n') + '\n', order };
}

function writeIndex(root) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root + ' — declare a bucket with role "todo" in .fankeel/docs.json');
    const { text } = render(root, readFolder(root, folder), folder);
    fs.writeFileSync(path.join(root, 'TODO.md'), text);
    return text;
}

// The one way an entry file is made. Ids are never reused: an existing file
// is a refusal, and a deleted one is todo-check's.
function add(root, fields) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root);
    const state = fields.state || 'decision';
    if (!STATES.includes(state) || state === 'done') {
        throw new Error('state is one of ready, decision, blocked, watch — not "' + state + '"');
    }
    const description = String(fields.description || '').replace(/\s+/g, ' ').trim();
    if (!description) throw new Error('a description is required: it is the line TODO.md prints');
    const title = String(fields.title || titleOf(description)).trim();
    if (width(title) > MAX_TITLE_WIDTH) {
        throw new Error('title is ' + width(title) + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two');
    }
    const id = fields.id || newId(readFolder(root, folder), fields.label);
    if (!ID.test(id)) throw new Error('"' + id + '" is not a lowercase kebab id');
    const file = folder + '/' + id + '.md';
    const full = path.join(root, file);
    if (fs.existsSync(full)) throw new Error(id + ' already exists; ids are never reused');
    fs.writeFileSync(full, serialize({
        label: fields.label || '', title, description, state, link: fields.link || '', group: fields.group || '',
        timing: fields.timing || '', stamp: fields.stamp || '', done: null, body: fields.body || '',
    }));
    writeIndex(root);
    return { id, file, path: full };
}

// Closing is a state, not a deletion: the file stays, with the commit that
// closed it and, where known, the session.
function close(root, id, opts) {
    const folder = folderOf(root);
    if (!folder) throw new Error('no todo folder under ' + root);
    const file = folder + '/' + id + '.md';
    const full = path.join(root, file);
    let text;
    try {
        text = fs.readFileSync(full, 'utf8');
    } catch (e) {
        throw new Error('no entry ' + id + ' in ' + folder);
    }
    const e = parse(text);
    if (e.state === 'done') throw new Error(id + ' is already done');
    const o = opts || {};
    if (!SHA.test(String(o.sha || ''))) throw new Error('--sha <commit> is required: the durable link to the work');
    const disposition = o.disposition || 'done';
    if (!DISPOSITIONS.includes(disposition)) throw new Error('disposition is one of ' + DISPOSITIONS.join(', '));
    e.state = 'done';
    e.done = { at: o.at || isoDay(Date.now()), sha: o.sha, disposition, session: o.session || '' };
    fs.writeFileSync(full, serialize(e));
    writeIndex(root);
    return { id, file };
}

// Both modes, one shape. Folder mode renders the index and reads it with the
// same `entries()` and `timings()` a hand-written file gets, then pairs each
// bullet with its file by position.
function load(root, now) {
    const at = now === undefined ? Date.now() : now;
    const folder = folderOf(root);
    if (!folder) {
        let text;
        try {
            text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
        } catch (e) {
            return null;
        }
        return { mode: 'file', folder: null, text, all: [], entries: entries(text), timings: timings(text, at), done: [] };
    }
    const all = readFolder(root, folder);
    const { text, order } = render(root, all, folder);
    const known = new Map(all.map((e) => [e.id, e]));
    const found = entries(text).map((e, i) => {
        const f = known.get(order[i]) || {};
        return Object.assign(e, { id: f.id, file: f.file, label: f.label, title: f.title, state: f.state,
            condition: f.timing, stamp: f.stamp });
    });
    const done = all.filter((e) => e.state === 'done').map((e) => ({
        id: e.id, file: e.file, label: e.label, title: e.title, description: e.description, link: e.link,
        at: e.done ? e.done.at : '', sha: e.done ? e.done.sha : '', disposition: e.done ? e.done.disposition : '',
        session: e.done ? e.done.session : '',
    })).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id, 'en', { numeric: true }));
    return { mode: 'folder', folder, text, all, entries: found, timings: timings(text, at), done };
}

// ---- migrate ---------------------------------------------------------------

const RECORD = /^- original:\s*(.*)\r?\n\s+disposition:\s*(.*)\r?\n\s+sha:\s*(\S+)/gm;

// The completions page's records, newest first as the page keeps them. A
// record whose sha is not a commit is the page's own format example.
function completions(root) {
    let text;
    try {
        text = fs.readFileSync(path.join(root, COMPLETIONS_PAGE), 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const m of text.matchAll(RECORD)) {
        if (!SHA.test(m[3])) continue;
        out.push({ original: m[1].trim(), disposition: m[2].trim(), sha: m[3] });
    }
    return out;
}

function commitDay(root, sha) {
    try {
        return execFileSync('git', ['show', '-s', '--format=%cs', sha], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    } catch (e) {
        return null;
    }
}

// Once: a hand-written TODO.md and its completions page become entry files,
// and the index is regenerated. `left` is every bullet under no known heading,
// which the new index no longer carries — printed for a person to re-add.
function migrate(root, now) {
    const at = now === undefined ? Date.now() : now;
    const folder = bucketPath(root);
    if (!folder) throw new Error('declare a bucket with role "todo" in .fankeel/docs.json first');
    const dir = path.join(root, folder);
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.endsWith('.md'))) {
        throw new Error(folder + ' already holds entries; migrate runs once');
    }
    const text = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    fs.mkdirSync(dir, { recursive: true });
    const made = [];
    const write = (entry) => {
        const id = newId(made, entry.label);
        made.push({ id });
        fs.writeFileSync(path.join(dir, id + '.md'), serialize(entry));
    };
    const left = [];
    const found = timings(text, at);
    for (const e of entries(text)) {
        const state = STATE_OF[e.section];
        if (!state) {
            left.push({ line: e.line, text: e.text });
            continue;
        }
        const f = fromLine(e.text, linksIn(e.text)[0] || '', state);
        const t = e.timing === null ? null : found.find((x) => x.line === e.timing);
        write(Object.assign(f, {
            group: t ? t.title : '',
            timing: t && t.kind ? t.kind + ': ' + (t.event || '') : '',
            stamp: t && t.stamp !== null ? isoDay(t.stamp) : '',
            done: null, body: '',
        }));
    }
    const records = completions(root).reverse();
    for (const r of records) {
        const f = fromLine(r.original, linksIn(r.original)[0] || '', 'done');
        write(Object.assign(f, {
            group: '', timing: '', stamp: '', body: '',
            done: { at: commitDay(root, r.sha) || isoDay(at), sha: r.sha, disposition: r.disposition, session: '' },
        }));
    }
    writeIndex(root);
    return { open: made.length - records.length, done: records.length, left };
}

module.exports = {
    MAX_ENTRY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    STATES, ID, ISO, DATE, conditionAt, mmdd, linksIn, entries, timings,
    isoDay, folderOf, parse, serialize, readFolder, render, writeIndex, fromLine, add, close, load, migrate,
};
