'use strict';
// assets/tune/overlay.js has two halves. The pure helpers (itemsOf, clampTo,
// selectorOf...) are called directly. The DOM half is EXECUTED here against a
// small hand-written stub document (no jsdom): the logo's drag and click, the
// tray, the per-item notes, 全部送出, and the capture-phase swallowing while
// picking are driven by dispatching events through the listeners the script
// registered. Still not checked: a real browser, real hit-testing, layout,
// pointer capture, focus, or how it looks. That is the render reviewer's
// question, at verify. Text checks that remain: wording, endpoint names, and
// three code shapes (the CSS pulse rule and its reduced-motion rule,
// `q.editing`, `setInterval(refreshQueue, 2000)`), which assert the source
// says so, not that it runs. Listeners no test dispatches: the logo's
// pointercancel, the fold and clear buttons, document mousemove beyond the
// hovers the two wheel tests fire, window blur, keyup and keypress, scroll and
// resize, the draft number button click (overlay.js:348), the chip remove x
// click (:360), the draft delete button click (:373), the diff link click
// (:769), and the keydown tray-close branch (Escape, or any keystroke from
// inside the assistant when not picking, overlay.js:676-686).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'assets', 'tune', 'overlay.js');

test('the overlay parses as a script', () => {
    assert.doesNotThrow(() => new Function(fs.readFileSync(SRC, 'utf8')));
});

test('the overlay speaks every endpoint tune.js serves it for', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['/__live/request', '/__live/events', '/__live/queue', '/__live/diff/', 'data-block', 'Escape']) {
        assert.ok(text.includes(s), 'overlay.js never mentions ' + s);
    }
});

test('the five states carry the words the approved mockup shows', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['這塊要怎麼改？', '已送出，等待改寫…', '已改寫 · 只動了 ', '退回：改到區塊外（', '原檔未變', '看差異', '佇列 ']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
});

const { selectorOf, labelOf, pathOf } = require('../assets/tune/overlay.js');

// A few element-shaped objects: enough of the DOM for the pure half.
function node(tag, attrs, kids) {
    const n = Object.assign({ nodeType: 1, tagName: tag.toUpperCase(), id: '', className: '', children: [], parentNode: null }, attrs);
    n.classList = String(n.className).split(/\s+/).filter(Boolean);
    for (const k of kids || []) { k.parentNode = n; n.children.push(k); }
    return n;
}

test('a block tune is editing carries a quiet pulse and its round, and none under reduced motion', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /\.fk-live-edp\{[^}]*animation:fk-live-edp /);
    assert.match(text, /@media \(prefers-reduced-motion:reduce\)\{[^']*\.fk-live-edp\{animation:none/);
    assert.ok(text.includes('編輯中 第 '), 'the ring does not say which round');
    assert.match(text, /q\.editing/);
    assert.match(text, /setInterval\(refreshQueue, 2000\)/);
});

test('selectorOf, labelOf and pathOf describe any element, stopping at an id or the body', () => {
    const b2 = node('b', { className: 'rs big' });
    const b1 = node('b');
    const div = node('div', { className: 'card' }, [b1, node('i'), b2]);
    const main = node('main', { id: 'app' }, [node('div'), div]);
    const body = node('body', {}, [main]);
    assert.equal(selectorOf(b2, body), 'main#app > div:nth-of-type(2) > b:nth-of-type(2)');
    assert.equal(labelOf(b2), 'b.rs.big');
    assert.equal(labelOf(main), 'main#app');
    assert.deepEqual(pathOf(b2, body).map(labelOf), ['b.rs.big', 'div.card', 'main#app']);
});

test('toggleIn adds an element once and a second toggle removes it', () => {
    const { toggleIn } = require('../assets/tune/overlay.js');
    const a = {}, b = {};
    assert.deepEqual(toggleIn([], a), [a]);
    assert.deepEqual(toggleIn([a], b), [a, b]);
    assert.deepEqual(toggleIn([a, b], a), [b]);
});

test('the assistant carries the words the approved mockup shows, and the station glyph', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['修改項', '新增一則', '收合', '刪除這則', '塊共用一段備註，要怎麼改？', '圈選第 ', '往外一層', '或滾輪：上 往外，下 往內', '完成這則', '全部送出（', '清空', '則待送', '按住拖曳']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
    assert.ok(text.includes('M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z'), 'the logo is not the station glyph');
    assert.ok(!/class="g(seg|edge|core)"/.test(text), 'a glyph class without the fk-live- prefix picks up the page\'s own .gseg rules');
});

test('itemsOf keeps drafts with a note and an element, the first element on the item, every block once', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const p = (block, selector) => ({ block, selector, classes: ['c'], text: 't' });
    const got = itemsOf([
        { note: ' one ', picks: [p('hero', 'section:nth-of-type(1)')] },
        { note: 'two', picks: [p('card', 'article#a'), p('card', 'article#b'), p('foot', 'footer')] },
        { note: '   ', picks: [p('x', 'div')] },
        { note: 'no element', picks: [] },
    ]);
    assert.deepEqual(got, [
        { note: 'one', block: 'hero', selector: 'section:nth-of-type(1)', classes: ['c'], text: 't' },
        { note: 'two', block: 'card', selector: 'article#a', classes: ['c'], text: 't', blocks: ['card', 'foot'], selectors: ['article#a', 'article#b', 'footer'] },
    ]);
});

test('clampTo keeps the logo inside the viewport', () => {
    const { clampTo } = require('../assets/tune/overlay.js');
    assert.deepEqual(clampTo(-20, 900, 48, 48, 1280, 800), { x: 0, y: 752 });
    assert.deepEqual(clampTo(600, 300, 48, 48, 1280, 800), { x: 600, y: 300 });
});

test('the header says the button goes out only and the wheel goes both ways', () => {
    const head = fs.readFileSync(SRC, 'utf8').split('\n').slice(0, 12).join('\n');
    assert.ok(head.includes('(out only)') && head.includes('the wheel goes both ways'), 'header must say the button is out only');
});

test('the design and build skills and the mockup agent describe the assistant and items, not Alt', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\s+/g, ' ');
    for (const p of ['skills/fankeel-design/SKILL.md', 'skills/fankeel-build/SKILL.md']) {
        const text = read(p);
        assert.doesNotMatch(text, /Alt\+click|Alt\+wheel|holding Alt/, p + ' still describes the Alt overlay');
        assert.match(text, /fankeel logo/, p + ' does not name the assistant');
        assert.match(text, /全部送出/, p + ' does not say how the items are sent');
        assert.match(text, /`items`/, p + ' does not name the items field');
    }
    assert.match(read('agents/fankeel-mockup.md'), /A request with `items` is several changes sent together/);
});

// tune-3: a frame and a spacer row with no name of their own are what the
// overlay cannot send, so the mockup agent is told to name them.
test('the mockup agent names the frame and the spacer row as blocks of their own', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-mockup.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(text, /A frame that wraps several blocks, and a row that sits between two blocks, each carry a `data-block` of their own/);
    assert.match(text, /One granularity per page/);
});

// ---- The DOM half, executed against a hand-written stub document. ----------
// OVERLAY_SRC lets a mutated copy of overlay.js be run through the same tests.
const DOM_SRC = process.env.OVERLAY_SRC || SRC;

function makeEl(doc, tag) {
    const e = {
        nodeType: 1, tagName: String(tag).toUpperCase(), id: '', children: [], parentNode: null,
        style: {}, hidden: false, disabled: false, value: '', _text: '', _attrs: {}, _on: {},
        rect: { left: 0, top: 0, width: 0, height: 0 }, offsetHeight: 0,
    };
    const cl = [];
    cl.add = (c) => { if (!cl.includes(c)) cl.push(c); };
    cl.remove = (c) => { const i = cl.indexOf(c); if (i >= 0) cl.splice(i, 1); };
    cl.contains = (c) => cl.includes(c);
    cl.toggle = (c, force) => { const on = force === undefined ? !cl.includes(c) : !!force; if (on) cl.add(c); else cl.remove(c); return on; };
    e.classList = cl;
    Object.defineProperty(e, 'className', {
        get: () => cl.join(' '),
        set: (v) => { cl.length = 0; String(v).split(/\s+/).filter(Boolean).forEach((c) => cl.push(c)); },
    });
    Object.defineProperty(e, 'textContent', {
        get: () => e._text + e.children.map((k) => k.textContent).join(''),
        set: (v) => { e.children.length = 0; e._text = String(v); },
    });
    Object.defineProperty(e, 'innerHTML', {
        get: () => '',
        set: (html) => {
            e.children.length = 0; e._text = '';
            const stack = [e];
            const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
            let m;
            while ((m = re.exec(String(html)))) {
                const top = stack[stack.length - 1];
                if (m[5] !== undefined) { top._text += m[5]; continue; }
                if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
                const k = makeEl(doc, m[2]);
                const ar = /([\w-]+)(?:="([^"]*)")?/g;
                let a;
                while ((a = ar.exec(m[3]))) {
                    if (a[1] === 'class') k.className = a[2];
                    else if (a[1] === 'hidden') k.hidden = true;
                    else k.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
                }
                k.parentNode = top; top.children.push(k);
                if (!m[4]) stack.push(k);
            }
        },
    });
    e.setAttribute = (k, v) => { e._attrs[k] = String(v); };
    e.getAttribute = (k) => (k in e._attrs ? e._attrs[k] : null);
    e.hasAttribute = (k) => k in e._attrs;
    e.appendChild = (k) => { if (k.parentNode) k.remove(); k.parentNode = e; e.children.push(k); return k; };
    e.remove = () => { if (e.parentNode) { e.parentNode.children.splice(e.parentNode.children.indexOf(e), 1); e.parentNode = null; } };
    e.contains = (n) => { for (; n; n = n.parentNode) if (n === e) return true; return false; };
    e.getBoundingClientRect = () => e.rect;
    e.focus = () => { doc.activeElement = e; };
    e.setPointerCapture = () => {};
    e.addEventListener = (type, fn, opts) => {
        const capture = opts === true || !!(opts && opts.capture);
        (e._on[type] = e._on[type] || []).push({ fn, capture });
    };
    const match = (sel) => {
        if (sel === '[data-block]') return (n) => n.hasAttribute('data-block');
        const m = /^(?:body > )?(\w+)?((?:\.[\w-]+)*)(?::nth-of-type\((\d+)\))?(?:\[data-block="(.*)"\])?$/.exec(sel);
        if (!m) return () => false;
        return (n) => (!m[1] || n.tagName === m[1].toUpperCase())
            && (m[3] === undefined || (n.parentNode && n.parentNode.children.filter((k) => k.tagName === n.tagName).indexOf(n) === m[3] - 1))
            && m[2].split('.').filter(Boolean).every((c) => n.classList.includes(c))
            && (m[4] === undefined || n.getAttribute('data-block') === m[4]);
    };
    e.querySelectorAll = (sel) => {
        const ok = match(sel), out = [];
        (function walk(n) { for (const k of n.children) { if (ok(k)) out.push(k); walk(k); } }(e));
        return out;
    };
    e.querySelector = (sel) => e.querySelectorAll(sel)[0] || null;
    return e;
}

// Loads overlay.js into a fresh stub page: a 1280x800 viewport, a body with
// three page blocks, and a recording fetch, localStorage and listener table.
function loadOverlay(shared) {
    const doc = { nodeType: 9, parentNode: null, _on: {}, activeElement: null };
    const win = { _on: {}, scrollX: 0, scrollY: 0, open() {} };
    for (const o of [doc, win]) {
        o.addEventListener = (type, fn, opts) => {
            const capture = opts === true || !!(opts && opts.capture);
            (o._on[type] = o._on[type] || []).push({ fn, capture });
        };
    }
    doc.createElement = (t) => makeEl(doc, t);
    doc.documentElement = makeEl(doc, 'html');
    doc.documentElement.clientWidth = 1280;
    doc.documentElement.clientHeight = 800;
    doc.documentElement.parentNode = doc;
    doc.head = doc.createElement('head');
    doc.body = doc.createElement('body');
    doc.documentElement.appendChild(doc.head);
    doc.documentElement.appendChild(doc.body);
    doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
    doc.all = doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
    doc.contains = (n) => doc.documentElement.contains(n);
    const page = {};
    for (const [name, text] of [['hero', 'Welcome'], ['card', 'Card one'], ['foot', 'Footer']]) {
        const p = doc.createElement('section');
        p.className = name + '-c';
        p.setAttribute('data-block', name);
        p.textContent = text;
        doc.body.appendChild(p);
        page[name] = p;
    }
    const store = () => { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
    const sessionStorage = (shared && shared.sessionStorage) || store(), localStorage = store();
    const fetched = [];
    const fetchStub = (url, init) => {
        fetched.push({ url, init });
        if (url === '/__live/request' && shared && shared.refuse) return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve(shared.refuse) });
        const body = url === '/__live/request' ? { id: 'r1' } : { pending: 0, editing: [] };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    };
    function EventSource() {}
    new Function('window', 'document', 'sessionStorage', 'localStorage', 'fetch', 'location', 'EventSource', 'setInterval', 'setTimeout',
        fs.readFileSync(DOM_SRC, 'utf8'))(win, doc, sessionStorage, localStorage, fetchStub, { pathname: '/p.html', reload() {} }, EventSource, () => 0, () => 0);

    // Capture pass window -> target's parent, then the target, then bubbling.
    function fire(target, type, props) {
        const ev = Object.assign({
            type, target, button: 0, detail: 1, defaultPrevented: false, _stop: false, _stopNow: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this._stop = true; },
            stopImmediatePropagation() { this._stop = true; this._stopNow = true; },
        }, props);
        const chain = [];
        for (let n = target; n; n = n.parentNode) chain.push(n);
        chain.push(win);
        const run = (n, capture) => {
            for (const l of (n._on[type] || []).filter((x) => x.capture === capture)) { l.fn(ev); if (ev._stopNow) break; }
        };
        for (let i = chain.length - 1; i > 0 && !ev._stop; i--) run(chain[i], true);
        if (!ev._stop) run(target, true);
        if (!ev._stopNow) run(target, false);
        for (let i = 1; i < chain.length && !ev._stop; i++) run(chain[i], false);
        return ev;
    }
    const q = (sel) => doc.querySelector(sel);
    const logo = q('.fk-live-logo');
    const t = {
        doc, win, page, fire, q, logo, fetched, localStorage, sessionStorage, tray: q('.fk-live-tray'), ast: q('.fk-live-ast'),
        press: (x, y, id = 1) => fire(logo, 'pointerdown', { clientX: x, clientY: y, pointerId: id }),
        move: (x, y, id = 1) => fire(logo, 'pointermove', { clientX: x, clientY: y, pointerId: id }),
        release: (id = 1) => fire(logo, 'pointerup', { pointerId: id }),
        tick: () => new Promise((r) => setImmediate(r)),
    };
    t.openTray = () => { if (t.tray.hidden) { t.press(5, 5); t.release(); } };
    // 新增一則, click each block, 完成這則, then write the note when given one.
    t.draft = (blocks, note) => {
        fire(q('.fk-live-add'), 'click');
        for (const b of blocks) fire(page[b], 'click');
        fire(q('.fk-live-fin'), 'click');
        const areas = doc.all('textarea');
        const area = areas[areas.length - 1];
        if (note !== undefined) { area.value = note; fire(area, 'input'); }
        return area;
    };
    return t;
}

test('dragging the logo moves it, clamps it inside the viewport, keeps the spot, and the click that ends a drag does not fold the tray', () => {
    const t = loadOverlay();
    assert.equal(t.ast.style.left, '1216px');
    assert.equal(t.ast.style.top, '736px');
    t.press(1230, 750);
    t.move(1231, 751);
    assert.equal(t.ast.style.left, '1216px', 'a move under 5px is still a click');
    t.move(930, 550);
    assert.equal(t.ast.style.left, '916px');
    assert.equal(t.ast.style.top, '536px');
    assert.ok(t.logo.classList.contains('fk-live-drag'));
    t.release();
    assert.ok(!t.logo.classList.contains('fk-live-drag'));
    assert.deepEqual(JSON.parse(t.localStorage.m['fk-live-ast-pos']), { x: 916, y: 536 });
    t.fire(t.logo, 'click', { detail: 1 });
    assert.equal(t.tray.hidden, false, 'the click that ends a drag folded the tray');
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    t.press(930, 550);
    t.move(2930, 2550);
    assert.equal(t.ast.style.left, '1232px');
    assert.equal(t.ast.style.top, '752px');
    t.release();
    t.press(1240, 760);
    t.move(-3000, -3000);
    assert.equal(t.ast.style.left, '0px');
    assert.equal(t.ast.style.top, '0px');
    t.release();
});

test('another pointer\'s move does not drag the logo', () => {
    const t = loadOverlay();
    t.press(1230, 750);
    t.move(930, 550, 2);
    assert.equal(t.ast.style.left, '1216px', 'a second pointer dragged the logo');
    assert.ok(!t.logo.classList.contains('fk-live-drag'));
    t.move(930, 550);
    assert.equal(t.ast.style.left, '916px', 'the pressing pointer no longer drags');
    t.release();
});

// tune-5: a first-time reader never noticed the logo in the corner, so the
// tray is there when the page loads and the logo is what folds it.
test('a freshly loaded page shows the tray open, and the logo says it folds', () => {
    const t = loadOverlay();
    assert.equal(t.tray.hidden, false, 'the tray is folded behind the logo on load');
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    assert.ok(t.ast.classList.contains('fk-live-open'));
    assert.match(t.logo.getAttribute('aria-label'), /點一下收合$/);
});

test('a plain press and release of the logo toggles the tray and aria-expanded, once, and a keyboard click does too', () => {
    const t = loadOverlay();
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    t.press(5, 5);
    t.release();
    t.fire(t.logo, 'click', { detail: 1 });
    assert.equal(t.tray.hidden, true);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false');
    t.press(5, 5);
    t.release();
    t.fire(t.logo, 'click', { detail: 1 });
    assert.equal(t.tray.hidden, false);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'true');
    t.fire(t.logo, 'click', { detail: 0 });
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false');
    t.press(5, 5, 7);
    t.release(8);
    assert.equal(t.logo.getAttribute('aria-expanded'), 'false', 'another pointer\'s release must not toggle');
});

test('while picking, the capture listeners swallow the page\'s pointer and click events, never the overlay\'s own, and never when not picking', () => {
    const TYPES = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'click'];
    const t = loadOverlay();
    const seen = [];
    for (const type of TYPES) t.page.hero.addEventListener(type, () => seen.push(type));
    const own = [];
    for (const type of TYPES) t.logo.addEventListener(type, () => own.push(type));

    // Not picking: all of it is the page's, Alt or not.
    for (const type of TYPES) {
        const ev = t.fire(t.page.hero, type, { button: type === 'auxclick' ? 1 : 0, altKey: type === 'click' });
        assert.equal(ev.defaultPrevented, false, type + ' prevented while not picking');
    }
    assert.deepEqual(seen, TYPES, 'the page missed an event while not picking');
    assert.equal(t.q('.fk-live-badge').hidden, true, 'an Alt click picked something');

    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    seen.length = 0;
    for (const type of TYPES) {
        const ev = t.fire(t.page.hero, type, { button: type === 'auxclick' ? 2 : 0 });
        assert.equal(ev._stopNow, true, type + ' reached the page while picking');
        assert.equal(ev.defaultPrevented, type === 'mousedown' || type === 'click', type + ' preventDefault');
    }
    assert.deepEqual(seen, [], 'the page saw ' + seen);
    assert.equal(t.fire(t.page.hero, 'pointerdown', { button: 2 })._stopNow, false, 'a right-button press is not the assistant\'s');

    // The overlay's own elements are never swallowed. 完成這則 sits in the row
    // being picked, so it is clicked while that row is there, and a new item
    // keeps the assistant picking for the logo.
    assert.equal(t.fire(t.q('.fk-live-fin'), 'click').defaultPrevented, false);
    t.fire(t.q('.fk-live-add'), 'click');
    own.length = 0;
    for (const type of TYPES) {
        const ev = t.fire(t.logo, type, { button: type === 'auxclick' ? 1 : 0 });
        assert.equal(ev.defaultPrevented, false, type + ' on the logo was prevented');
    }
    assert.deepEqual(own, TYPES, 'the logo missed an event while picking');
});

test('while picking, a click on a page element picks it, a second click takes it back, and an Alt click is the same click', () => {
    const t = loadOverlay();
    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    const chips = () => t.doc.all('.fk-live-chip').length;
    t.fire(t.page.hero, 'click');
    assert.equal(chips(), 1);
    t.fire(t.page.card, 'click', { altKey: true });
    assert.equal(chips(), 2);
    t.fire(t.page.hero, 'click');
    assert.equal(chips(), 1);
    t.fire(t.doc.body, 'click');
    assert.equal(chips(), 1, 'the body is not pickable');
});

test('全部送出 posts every draft as items in one /__live/request, with no altKey', async () => {
    const t = loadOverlay();
    t.openTray();
    t.draft(['hero'], ' first ');
    t.draft(['card', 'foot'], 'second');
    assert.equal(t.q('.fk-live-badge').textContent, '2');
    assert.equal(t.q('.fk-live-all').textContent, '全部送出（2 則）');
    t.fire(t.q('.fk-live-all'), 'click');
    const posts = t.fetched.filter((f) => f.url === '/__live/request');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].init.method, 'POST');
    assert.ok(!/altKey/i.test(posts[0].init.body));
    const body = JSON.parse(posts[0].init.body);
    assert.equal(body.page, '/p.html');
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0].note, 'first');
    assert.equal(body.items[0].block, 'hero');
    assert.equal(body.items[0].text, 'Welcome');
    assert.deepEqual(body.items[0].classes, ['hero-c']);
    assert.match(body.items[0].selector, /section:nth-of-type\(1\)$/);
    assert.equal(body.items[1].note, 'second');
    assert.deepEqual(body.items[1].blocks, ['card', 'foot']);
    assert.equal(body.items[1].selectors.length, 2);
    await t.tick();
    assert.equal(t.q('.fk-live-badge').hidden, true, 'the sent drafts stayed');
    assert.ok(t.fetched.indexOf(t.fetched.filter((f) => f.url === '/__live/queue').pop()) > t.fetched.indexOf(posts[0]), 'the queue was not read after sending');
});

test('a draft with an empty note blocks sending, names the draft, and sends once it is written', async () => {
    const t = loadOverlay();
    t.openTray();
    t.draft(['hero'], 'ok');
    const blank = t.draft(['card']);
    t.fire(t.q('.fk-live-all'), 'click');
    assert.equal(t.fetched.filter((f) => f.url === '/__live/request').length, 0, 'an empty note was sent');
    assert.equal(t.q('.fk-live-queue').querySelector('span').textContent, '第 2 則還沒寫備註');
    assert.ok(blank.classList.contains('fk-live-err'));
    assert.equal(t.doc.activeElement, blank);
    blank.value = 'now';
    t.fire(blank, 'input');
    assert.ok(!blank.classList.contains('fk-live-err'));
    t.fire(t.q('.fk-live-all'), 'click');
    const posts = t.fetched.filter((f) => f.url === '/__live/request');
    assert.equal(posts.length, 1);
    assert.equal(JSON.parse(posts[0].init.body).items.length, 2);
    await t.tick();
});

test('the drafts are saved to sessionStorage as note and pick selectors, and a fresh overlay restores them into the tray', () => {
    const a = loadOverlay();
    a.openTray();
    a.draft(['hero'], 'first');
    a.draft(['card', 'foot'], 'second');
    const saved = JSON.parse(a.sessionStorage.m['fk-live-drafts']);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].note, 'first');
    assert.deepEqual(saved[0].picks, ['section:nth-of-type(1)']);
    assert.equal(saved[1].note, 'second');
    assert.deepEqual(saved[1].picks, ['section:nth-of-type(2)', 'section:nth-of-type(3)']);
    const b = loadOverlay({ sessionStorage: a.sessionStorage });
    assert.equal(b.q('.fk-live-badge').textContent, '2', 'the restored drafts are not counted');
    b.openTray();
    assert.deepEqual(b.doc.all('textarea').map((x) => x.value), ['first', 'second']);
    assert.equal(b.doc.all('.fk-live-chip').length, 3, 'the picks were not found again on the fresh page');
});

test('while picking, the wheel belongs to the assistant and walks the outline, and the page keeps it otherwise', () => {
    const t = loadOverlay();
    t.openTray();
    assert.equal(t.fire(t.page.hero, 'wheel', { deltaY: -100 }).defaultPrevented, false, 'the wheel was swallowed while not picking');
    t.fire(t.q('.fk-live-add'), 'click');
    assert.equal(t.fire(t.page.hero, 'wheel', { deltaY: -100 }).defaultPrevented, false, 'the wheel was swallowed with nothing outlined');
    t.fire(t.page.hero, 'mousemove');
    assert.equal(t.fire(t.page.hero, 'wheel', { deltaY: -100 }).defaultPrevented, true, 'the wheel scrolled the page while picking');
    assert.equal(t.fire(t.q('.fk-live-fin'), 'wheel', { deltaY: -100 }).defaultPrevented, false, 'the wheel over the assistant was swallowed');
});

// tune-2: the wheel test above asserts only defaultPrevented. This one asserts
// where the walk goes — up is out to the parent, down is back in — and that a
// click inside the outline takes the outlined element, not the one under it.
test('while picking, the wheel walks out to the parent and back in, and a click inside the outline takes the outlined element', () => {
    const withSpan = () => {
        const t = loadOverlay();
        const span = t.doc.createElement('span');
        t.page.hero.appendChild(span);
        t.openTray();
        t.fire(t.q('.fk-live-add'), 'click');
        return { t, span };
    };
    const chips = (t) => t.doc.all('.fk-live-chip').map((c) => c.textContent);
    const ref = (pick) => { const { t, span } = withSpan(); t.fire(pick === 'span' ? span : t.page.hero, 'click'); return chips(t); };
    const hero = ref('hero');
    const inner = ref('span');
    assert.notDeepEqual(hero, inner, 'the two picks must read differently for this test to tell them apart');

    const { t, span } = withSpan();
    t.fire(span, 'mousemove');
    assert.equal(t.fire(span, 'wheel', { deltaY: -100 }).defaultPrevented, true);
    t.fire(span, 'click');
    assert.deepEqual(chips(t), hero, 'the wheel up did not walk out to the parent, or the click took the element under the pointer');
    t.fire(span, 'click');
    assert.deepEqual(chips(t), [], 'a second click inside the outline did not take it back');
    t.fire(span, 'wheel', { deltaY: 100 });
    t.fire(span, 'click');
    assert.deepEqual(chips(t), inner, 'the wheel down did not walk back in');
});

test('Escape while picking drops the pick, removes a draft left with no element, and the page does not see the key', () => {
    const t = loadOverlay();
    t.openTray();
    t.draft(['hero'], 'keep');
    t.fire(t.q('.fk-live-add'), 'click');
    t.fire(t.page.card, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 2);
    const seen = [];
    t.page.card.addEventListener('keydown', () => seen.push(1));
    const ev = t.fire(t.page.card, 'keydown', { key: 'Escape' });
    assert.equal(ev._stopNow, true);
    assert.deepEqual(seen, []);
    assert.equal(t.doc.all('.fk-live-chip').length, 1, 'the unfinished draft stayed');
    assert.equal(t.q('.fk-live-badge').textContent, '1');
    assert.equal(t.fire(t.page.card, 'keydown', { key: 'Escape' })._stopNow, false, 'Escape with nothing to end was swallowed');
});

// tune-3: a pick is resolved to blocks when it is made. An element inside a
// block stands for that block; a frame around blocks stands for every block
// inside it; an element with neither is outlined amber, told why, and not taken.
test('itemsOf sends every block a frame pick resolved to, the first one as block', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const frame = { block: 'card', blocks: ['card', 'foot'], selector: 'div:nth-of-type(1)', classes: ['term'], text: 't' };
    const inner = { block: 'hero', blocks: ['hero'], selector: 'section:nth-of-type(1)', classes: [], text: 'h' };
    assert.deepEqual(itemsOf([{ note: 'one', picks: [frame] }, { note: 'two', picks: [inner, frame] }, { note: 'three', picks: [inner] }]), [
        { note: 'one', block: 'card', blocks: ['card', 'foot'], selector: 'div:nth-of-type(1)', classes: ['term'], text: 't' },
        { note: 'two', block: 'hero', blocks: ['hero', 'card', 'foot'], selector: 'section:nth-of-type(1)', classes: [], text: 'h', selectors: ['section:nth-of-type(1)', 'div:nth-of-type(1)'] },
        { note: 'three', block: 'hero', selector: 'section:nth-of-type(1)', classes: [], text: 'h' },
    ]);
});

// A frame around card and foot, with a spacer row between them that carries no
// data-block, appended to the stub page; picking has begun.
function withFrame() {
    const t = loadOverlay();
    const frame = t.doc.createElement('div');
    frame.className = 'term';
    const gap = t.doc.createElement('div');
    gap.className = 'gap';
    t.doc.body.appendChild(frame);
    frame.appendChild(t.page.card);
    frame.appendChild(gap);
    frame.appendChild(t.page.foot);
    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    return { t, frame, gap };
}

test('while picking, a click on a frame takes every block inside it, and an element with no block is told why and not taken', async () => {
    const { t, frame, gap } = withFrame();
    const chips = () => t.doc.all('.fk-live-chip').map((c) => c.textContent);
    const tag = () => t.q('.fk-live-tag');
    const box = () => t.q('.fk-live-box');

    t.fire(gap, 'mousemove');
    assert.equal(tag().textContent, 'div.gap · 沒有 data-block，往外或往內一層');
    assert.ok(box().classList.contains('fk-live-bad'), 'the outline of an element with no block is not amber');
    assert.ok(tag().classList.contains('fk-live-bad'), 'the label of an element with no block is not amber');
    t.fire(gap, 'click');
    assert.deepEqual(chips(), [], 'an element with no data-block in or around it was taken');

    t.fire(frame, 'mousemove');
    assert.equal(tag().textContent, 'div.term · 外框·2 塊');
    assert.ok(!box().classList.contains('fk-live-bad'), 'a frame around blocks is outlined amber');
    t.fire(frame, 'click');
    assert.deepEqual(chips(), ['div.term · 外框·2 塊×']);

    t.fire(t.page.hero, 'mousemove');
    assert.equal(tag().querySelector('b').textContent, 'hero', 'the label of an element in a block does not name the block');
    assert.ok(!tag().classList.contains('fk-live-bad'));

    t.fire(t.q('.fk-live-fin'), 'click');
    const area = t.doc.all('textarea').pop();
    area.value = '整個外框換底色';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const item = JSON.parse(t.fetched.filter((f) => f.url === '/__live/request')[0].init.body).items[0];
    assert.equal(item.block, 'card');
    assert.deepEqual(item.blocks, ['card', 'foot']);
    assert.match(item.selector, /^div:nth-of-type\(\d+\)$/);
    assert.equal(item.selectors, undefined);
    await t.tick();
});

// tune-3: a refusal that names an item keeps every draft, marks that item's
// row, and says which one on the queue line; one that names none marks none.
test('a refused send keeps the drafts, marks the item the server named, and says which one', async () => {
    const why = 'div.r 不在任何 data-block 內；按這一則的編號重新圈選，往外或往內一層';
    const t = loadOverlay({ refuse: 'item 2: ' + why });
    t.openTray();
    t.draft(['hero'], 'first');
    t.draft(['card'], 'second');
    t.fire(t.q('.fk-live-all'), 'click');
    await t.tick();
    assert.equal(t.q('.fk-live-badge').textContent, '2', 'a refused send dropped the drafts');
    assert.deepEqual(t.doc.all('textarea').map((x) => x.value), ['first', 'second']);
    assert.equal(t.q('.fk-live-queue').querySelector('span').textContent, '第 2 則：' + why);
    assert.deepEqual(t.doc.all('.fk-live-item').map((li) => li.classList.contains('fk-live-err')), [false, true]);

    const plain = loadOverlay({ refuse: 'not JSON' });
    plain.openTray();
    plain.draft(['hero'], 'first');
    plain.fire(plain.q('.fk-live-all'), 'click');
    await plain.tick();
    assert.equal(plain.q('.fk-live-queue').querySelector('span').textContent, 'not JSON');
    assert.deepEqual(plain.doc.all('.fk-live-item').map((li) => li.classList.contains('fk-live-err')), [false]);
});

// tune-4: the item being picked carries its note field and its two buttons, so
// what the user does next is in the row the pick belongs to.
test('the row being picked has its note field, and 往外一層 and 完成這則 sit in it', () => {
    const t = loadOverlay();
    const span = t.doc.createElement('span');
    t.page.card.appendChild(span);
    t.openTray();
    t.fire(t.q('.fk-live-add'), 'click');
    const row = () => t.q('.fk-live-item.fk-live-picking');
    assert.ok(row(), 'no row is marked as the one being picked');
    const area = row().querySelector('textarea');
    assert.ok(area, 'the row being picked has no note field');
    assert.ok(row().querySelector('.fk-live-out'), '往外一層 is not in the row being picked');
    assert.ok(row().querySelector('.fk-live-fin'), '完成這則 is not in the row being picked');
    assert.equal(t.q('.fk-live-hint').querySelector('button'), null, 'the hint still carries a button');

    area.value = '先寫備註';
    t.fire(area, 'input');
    t.fire(t.page.hero, 'click');
    assert.equal(row().querySelector('textarea').value, '先寫備註', 'a pick threw the note away');

    t.fire(span, 'mousemove');
    t.fire(row().querySelector('.fk-live-out'), 'click');
    t.fire(span, 'click');
    assert.deepEqual(t.doc.all('.fk-live-chip').map((c) => c.textContent), ['section.hero-c×', 'section.card-c×'], '往外一層 in the row did not walk out to the parent');

    t.fire(row().querySelector('.fk-live-fin'), 'click');
    assert.equal(row(), null, '完成這則 in the row did not end the pick');
    assert.equal(t.q('.fk-live-out'), null, 'a row that is not being picked carries 往外一層');
    assert.deepEqual(t.doc.all('textarea').map((x) => x.value), ['先寫備註']);
    assert.equal(t.q('.fk-live-badge').textContent, '1');
});

// tune-6: an element a click opens — a dialog, a dropdown — can be picked.
// F2 starts a pick without touching the tray (a click there would close the
// page's popover, and a modal dialog makes the tray inert); the outline moves
// into the open dialog so it is drawn above it; an element with no block of
// its own takes the block of the page click that opened it, and says which.
function withDialog(t) {
    const dlg = t.doc.createElement('dialog');
    dlg.className = 'pick-d';
    dlg.open = true;
    const item = t.doc.createElement('button');
    item.className = 'opt';
    item.textContent = 'Option A';
    dlg.appendChild(item);
    t.doc.body.appendChild(dlg);
    return { dlg, item };
}

test('F2 starts a pick without a click on the tray, and the page does not see the key', () => {
    const t = loadOverlay();
    const ev = t.fire(t.doc.body, 'keydown', { key: 'F2' });
    assert.ok(ev._stopNow, 'the page saw F2');
    assert.ok(ev.defaultPrevented);
    assert.equal(t.q('.fk-live-hint').hidden, false, 'no pick started');
    t.fire(t.page.hero, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 1);
});

test('a click on the tray stops at the tray, so the page\'s outside-click handler never sees it', () => {
    const t = loadOverlay();
    t.openTray();
    let seen = 0;
    t.doc.addEventListener('click', () => { seen++; });
    t.fire(t.q('.fk-live-add'), 'click');
    assert.equal(seen, 0);
});

test('while picking, the outline is drawn inside an open dialog, and goes back to the body after', () => {
    const t = loadOverlay();
    const { dlg, item } = withDialog(t);
    t.fire(t.doc.body, 'keydown', { key: 'F2' });
    assert.equal(t.q('.fk-live-box').parentNode, dlg);
    assert.equal(t.q('.fk-live-box').style.position, 'fixed');
    t.fire(item, 'mousemove');
    t.fire(t.doc.body, 'keydown', { key: 'Escape' });
    assert.equal(t.q('.fk-live-box').parentNode, t.doc.body);
});

test('an element with no block, opened by a click on a block, is picked with that block and its opener', async () => {
    const t = loadOverlay();
    t.page.card.className = 'card-c';
    t.fire(t.page.card, 'click');
    const { dlg, item } = withDialog(t);
    t.fire(t.doc.body, 'keydown', { key: 'F2' });
    t.fire(item, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 1, 'the dialog\'s element was not taken');
    t.fire(t.q('.fk-live-fin'), 'click');
    dlg.remove();
    t.fire(t.page.hero, 'click');
    const area = t.doc.all('textarea').pop();
    area.value = '選項改成兩欄';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const body = JSON.parse(t.fetched.filter((f) => f.url === '/__live/request')[0].init.body);
    assert.equal(body.items[0].block, 'card');
    assert.match(body.items[0].opener, /section:nth-of-type\(2\)$/);
    assert.equal(body.items[0].text, 'Option A', 'the pick was described after the dialog closed');
    await t.tick();
});
