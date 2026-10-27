'use strict';
// assets/tune/overlay.js has two halves. The pure helpers (itemsOf,
// toolOfKey, selectorOf...) are called directly. The DOM half is EXECUTED
// here against a small hand-written stub document (no jsdom): the toolbar,
// its tools and shape menu, the 修改項 panel, the item card, the per-item
// notes, 全部送出, and the capture-phase swallowing while picking are driven
// by dispatching events through the listeners the script registered. Still
// not checked: a real browser, real hit-testing, layout, focus, or how it
// looks. That is the render reviewer's question, at verify. Text checks that
// remain: wording, endpoint names, radii and the font stack, and three code
// shapes (the CSS pulse rule and its reduced-motion rule, `q.editing`,
// `setInterval(refreshQueue, 2000)`), which assert the source says so, not
// that it runs. Listeners no test dispatches: the fold and clear buttons,
// window blur, keyup and keypress, scroll, the draft delete button, and the
// diff link.
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
    for (const s of ['這則要怎麼改？', '已送出，等待改寫…', '已改寫 · 只動了 ', '退回：改到區塊外（', '原檔未變', '看差異', '佇列 ']) {
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

test('the toolbar carries the words the approved mockup shows, and the station glyph', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['修改項', '新增一則', '收合修改項', '刪除這則', '個元素共用一段備註，要怎麼改？', '點元素加入，再點一次移出', '往外一層', '或滾輪：上 往外，下 往內', '完成這則', '全部送出（', '清空', '則待送', '選取元素', '畫筆', '形狀：', '文字', '收起工具列', '直線', '箭頭', '方框', '橢圓', '步驟編號', '歸到 data-block']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
    assert.ok(text.includes('M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z'), 'the logo is not the station glyph');
    assert.ok(!/class="g(seg|edge|core)"/.test(text), 'a glyph class without the fk-live- prefix picks up the page\'s own .gseg rules');
});

test('the toolbar takes the station\'s radii and font, and no square corner is left', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /\.fk-live-bar\{[^}]*border-radius:10px/);
    assert.match(text, /\.fk-live-tool\{[^}]*border-radius:6px/);
    assert.ok(!/border-radius:0[;}]/.test(text), 'a square corner is left over from the old tray');
    assert.ok(text.includes('"Bahnschrift","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",system-ui,sans-serif'), 'the station font stack is missing');
});

test('toolOfKey maps V, P, T, S and each shape\'s letter, in either case, and nothing else', () => {
    const { toolOfKey, SHAPES } = require('../assets/tune/overlay.js');
    assert.deepEqual(SHAPES.map((s) => s.id + ':' + s.key), ['line:l', 'arrow:a', 'rect:r', 'ellipse:o', 'step:n']);
    assert.equal(toolOfKey('V', 'arrow'), 'select');
    assert.equal(toolOfKey('p', 'arrow'), 'pen');
    assert.equal(toolOfKey('t', 'arrow'), 'text');
    assert.equal(toolOfKey('s', 'ellipse'), 'ellipse');
    assert.deepEqual(['l', 'A', 'r', 'o', 'n'].map((k) => toolOfKey(k, 'arrow')), ['line', 'arrow', 'rect', 'ellipse', 'step']);
    assert.equal(toolOfKey('x', 'arrow'), null);
    assert.equal(toolOfKey('Escape', 'arrow'), null);
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

test('the header says the button goes out only and the wheel goes both ways', () => {
    const head = fs.readFileSync(SRC, 'utf8').split('\n').slice(0, 12).join('\n');
    assert.ok(head.includes('(out only)') && head.includes('the wheel goes both ways'), 'header must say the button is out only');
});

test('the design and build skills and the mockup agent describe the assistant and items, not Alt', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\s+/g, ' ');
    for (const p of ['skills/fankeel-design/SKILL.md', 'skills/fankeel-build/SKILL.md']) {
        const text = read(p);
        assert.doesNotMatch(text, /Alt\+click|Alt\+wheel|holding Alt/, p + ' still describes the Alt overlay');
        assert.match(text, /fankeel toolbar/, p + ' does not name the toolbar');
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
    const t = {
        doc, win, page, fire, q, fetched, localStorage, sessionStorage,
        bar: q('.fk-live-bar'), panel: q('.fk-live-panel'), fab: q('.fk-live-fab'),
        tool: (id) => doc.all('.fk-live-tool').find((b) => b.getAttribute('data-tool') === id),
        tick: () => new Promise((r) => setImmediate(r)),
    };
    // The panel holds 新增一則 and 全部送出; opening it is one click on 修改項.
    t.openTray = () => { if (t.panel.hidden) fire(q('.fk-live-items'), 'click'); };
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

test('a fresh page shows the toolbar with no tool pressed, the panel shut and no count', () => {
    const t = loadOverlay();
    assert.equal(t.bar.hidden, false);
    assert.equal(t.bar.getAttribute('role'), 'toolbar');
    assert.equal(t.panel.hidden, true);
    assert.equal(t.fab.hidden, true);
    assert.equal(t.q('.fk-live-count').hidden, true);
    assert.deepEqual(['select', 'pen', 'text'].map((id) => t.tool(id).getAttribute('aria-pressed')), ['false', 'false', 'false']);
    assert.equal(t.q('.fk-live-shape').getAttribute('aria-label'), '形狀：箭頭');
    assert.equal(t.q('.fk-live-items').getAttribute('aria-label'), '修改項，0 則待送');
});

test('修改項 opens and shuts the panel, and X folds the toolbar into the logo, which a click or F2 opens again', () => {
    const t = loadOverlay();
    const items = t.q('.fk-live-items');
    t.fire(items, 'click');
    assert.equal(t.panel.hidden, false);
    assert.equal(items.getAttribute('aria-expanded'), 'true');
    t.fire(items, 'click');
    assert.equal(t.panel.hidden, true);
    t.fire(t.q('.fk-live-close'), 'click');
    assert.equal(t.bar.hidden, true);
    assert.equal(t.fab.hidden, false);
    t.fire(t.fab, 'click');
    assert.equal(t.bar.hidden, false);
    assert.equal(t.fab.hidden, true);
    t.fire(t.q('.fk-live-close'), 'click');
    t.fire(t.doc.body, 'keydown', { key: 'F2' });
    assert.equal(t.bar.hidden, false, 'F2 did not open the folded toolbar');
    assert.equal(t.tool('select').getAttribute('aria-pressed'), 'true');
});

test('the select tool opens an item; 完成這則 releases every tool and opens the panel on the item\'s note', () => {
    const t = loadOverlay();
    t.fire(t.tool('select'), 'click');
    assert.equal(t.tool('select').getAttribute('aria-pressed'), 'true');
    assert.equal(t.q('.fk-live-draft').hidden, false);
    assert.equal(t.q('.fk-live-say').textContent, '第 1 則：點元素加入，再點一次移出 · 已選 0 個');
    t.fire(t.page.hero, 'click');
    t.fire(t.q('.fk-live-fin'), 'click');
    assert.equal(t.tool('select').getAttribute('aria-pressed'), 'false');
    assert.equal(t.q('.fk-live-draft').hidden, true);
    assert.equal(t.panel.hidden, false, '完成這則 did not open the panel');
    assert.equal(t.doc.activeElement, t.doc.all('textarea').pop());
    assert.equal(t.q('.fk-live-count').textContent, '1');
});

test('the shape menu: the button opens it on the current shape, a click or a letter picks a shape, and Escape shuts only the menu', () => {
    const t = loadOverlay();
    const shapeBtn = t.q('.fk-live-shape');
    const menu = t.q('.fk-live-menu');
    const items = () => t.doc.all('.fk-live-mi');
    assert.deepEqual(items().map((b) => b.getAttribute('data-shape')), ['line', 'arrow', 'rect', 'ellipse', 'step']);
    t.fire(shapeBtn, 'click');
    assert.equal(menu.hidden, false);
    assert.equal(shapeBtn.getAttribute('aria-expanded'), 'true');
    assert.equal(shapeBtn.getAttribute('aria-pressed'), 'true', 'the shape tool is not pressed');
    t.fire(items()[2], 'click');
    assert.equal(menu.hidden, true);
    assert.equal(shapeBtn.getAttribute('aria-label'), '形狀：方框');
    assert.deepEqual(items().map((b) => b.getAttribute('aria-checked')), ['false', 'false', 'true', 'false', 'false']);
    t.fire(t.page.hero, 'keydown', { key: 'n' });
    assert.equal(shapeBtn.getAttribute('aria-label'), '形狀：步驟編號');
    t.fire(t.page.hero, 'keydown', { key: 's' });
    assert.equal(menu.hidden, false);
    t.fire(shapeBtn, 'keydown', { key: 'Escape' });
    assert.equal(menu.hidden, true);
    assert.equal(t.q('.fk-live-draft').hidden, false, 'Escape on the open menu closed the item');
    t.fire(t.page.hero, 'keydown', { key: 'Escape' });
    assert.equal(t.q('.fk-live-draft').hidden, true);
});

test('a letter typed into a note is the note\'s, and with no item open a letter on the page is the page\'s', () => {
    const t = loadOverlay();
    assert.equal(t.fire(t.page.hero, 'keydown', { key: 'p' })._stopNow, false, 'the page lost a letter while no item was open');
    assert.equal(t.tool('pen').getAttribute('aria-pressed'), 'false');
    t.fire(t.tool('select'), 'click');
    const area = t.q('.fk-live-draft').querySelector('textarea');
    assert.equal(t.fire(area, 'keydown', { key: 'p' }).defaultPrevented, false, 'a letter typed into the note was taken');
    assert.equal(t.tool('select').getAttribute('aria-pressed'), 'true');
    t.fire(t.page.hero, 'keydown', { key: 'p' });
    assert.equal(t.tool('pen').getAttribute('aria-pressed'), 'true');
    t.fire(t.page.hero, 'keydown', { key: 'v' });
    assert.equal(t.tool('select').getAttribute('aria-pressed'), 'true');
});

test('the hover label names the element and the data-block it goes to, a dashed box sits on that block, and the item carries both', async () => {
    const t = loadOverlay();
    const span = t.doc.createElement('span');
    span.className = 'gop';
    t.page.card.appendChild(span);
    t.page.card.rect = { left: 10, top: 300, width: 500, height: 200 };
    t.fire(t.tool('select'), 'click');
    t.fire(span, 'mousemove');
    assert.equal(t.q('.fk-live-tag').textContent, 'span.gop歸到 data-blockcard');
    const anc = t.q('.fk-live-anc');
    assert.equal(anc.style.display, '');
    assert.equal(anc.style.left, '10px');
    assert.equal(anc.style.top, '300px');
    t.fire(t.page.hero, 'mousemove');
    assert.equal(anc.style.display, 'none', 'a dashed box was drawn on a block that is the element itself');
    t.fire(span, 'mousemove');
    t.fire(span, 'click');
    assert.deepEqual(t.doc.all('.fk-live-chip').map((c) => c.textContent), ['span.gop歸到card']);
    t.fire(t.q('.fk-live-fin'), 'click');
    const area = t.doc.all('textarea').pop();
    area.value = '按鈕改成圖示';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const item = JSON.parse(t.fetched.find((f) => f.url === '/__live/request').init.body).items[0];
    assert.equal(item.block, 'card');
    assert.match(item.selector, /section:nth-of-type\(2\) > span:nth-of-type\(1\)$/);
    assert.deepEqual(item.classes, ['gop']);
    await t.tick();
});

test('with a drawing tool pressed, a click on the page picks nothing and the outline stays off', () => {
    const t = loadOverlay();
    t.fire(t.tool('pen'), 'click');
    assert.equal(t.q('.fk-live-draft').hidden, false, 'the pen did not open an item');
    t.fire(t.page.hero, 'mousemove');
    assert.equal(t.q('.fk-live-box').style.display, 'none');
    assert.equal(t.fire(t.page.hero, 'click')._stopNow, true, 'the page saw a click while drawing');
    assert.equal(t.doc.all('.fk-live-chip').length, 0);
    t.fire(t.tool('select'), 'click');
    t.fire(t.page.hero, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 1);
});

test('while picking, the capture listeners swallow the page\'s pointer and click events, never the overlay\'s own, and never when not picking', () => {
    const TYPES = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'click'];
    const t = loadOverlay();
    const seen = [];
    for (const type of TYPES) t.page.hero.addEventListener(type, () => seen.push(type));
    const items = t.q('.fk-live-items');
    const own = [];
    for (const type of TYPES) items.addEventListener(type, () => own.push(type));

    // Not picking: all of it is the page's, Alt or not.
    for (const type of TYPES) {
        const ev = t.fire(t.page.hero, type, { button: type === 'auxclick' ? 1 : 0, altKey: type === 'click' });
        assert.equal(ev.defaultPrevented, false, type + ' prevented while not picking');
    }
    assert.deepEqual(seen, TYPES, 'the page missed an event while not picking');
    assert.equal(t.q('.fk-live-count').hidden, true, 'an Alt click picked something');

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

    // The overlay's own elements are never swallowed: 完成這則 in the item
    // being picked, and 修改項 on the toolbar while a new item is open.
    assert.equal(t.fire(t.q('.fk-live-fin'), 'click').defaultPrevented, false);
    t.fire(t.q('.fk-live-add'), 'click');
    own.length = 0;
    for (const type of TYPES) {
        const ev = t.fire(items, type, { button: type === 'auxclick' ? 1 : 0 });
        assert.equal(ev.defaultPrevented, false, type + ' on 修改項 was prevented');
    }
    assert.deepEqual(own, TYPES, '修改項 missed an event while picking');
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
    assert.equal(t.q('.fk-live-count').textContent, '2');
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
    assert.equal(t.q('.fk-live-count').hidden, true, 'the sent drafts stayed');
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
    assert.equal(b.q('.fk-live-count').textContent, '2', 'the restored drafts are not counted');
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
    assert.equal(t.q('.fk-live-count').textContent, '1');
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
    assert.equal(tag().textContent, 'div.gap沒有 data-block，往外或往內一層');
    assert.ok(box().classList.contains('fk-live-bad'), 'the outline of an element with no block is not amber');
    assert.ok(tag().classList.contains('fk-live-bad'), 'the label of an element with no block is not amber');
    t.fire(gap, 'click');
    assert.deepEqual(chips(), [], 'an element with no data-block in or around it was taken');

    t.fire(frame, 'mousemove');
    assert.equal(tag().textContent, 'div.term外框·2 塊');
    assert.ok(!box().classList.contains('fk-live-bad'), 'a frame around blocks is outlined amber');
    t.fire(frame, 'click');
    assert.deepEqual(chips(), ['div.term外框·2 塊']);

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
    assert.equal(t.q('.fk-live-count').textContent, '2', 'a refused send dropped the drafts');
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

    area.value = '先寫備註';
    t.fire(area, 'input');
    t.fire(t.page.hero, 'click');
    assert.equal(row().querySelector('textarea').value, '先寫備註', 'a pick threw the note away');

    t.fire(span, 'mousemove');
    t.fire(row().querySelector('.fk-live-out'), 'click');
    t.fire(span, 'click');
    assert.deepEqual(t.doc.all('.fk-live-chip').map((c) => c.textContent), ['section.hero-c歸到hero', 'section.card-c歸到card'], '往外一層 in the row did not walk out to the parent');

    t.fire(row().querySelector('.fk-live-fin'), 'click');
    assert.equal(row(), null, '完成這則 in the row did not end the pick');
    assert.equal(t.q('.fk-live-out'), null, 'a row that is not being picked carries 往外一層');
    assert.deepEqual(t.doc.all('textarea').map((x) => x.value), ['先寫備註']);
    assert.equal(t.q('.fk-live-count').textContent, '1');
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
    assert.equal(t.q('.fk-live-draft').hidden, false, 'no pick started');
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

// tune-8: what the user draws on the page goes with the item it was drawn
// for, in page coordinates, with the scroll and viewport it was seen at.
test('inkOf draws each kind of mark in page coordinates, and escapes a text', () => {
    const { inkOf } = require('../assets/tune/overlay.js');
    assert.equal(inkOf({ type: 'pen', points: [[1, 2], [5, 6]] }), '<polyline points="1,2 5,6"/>');
    assert.equal(inkOf({ type: 'line', points: [[0, 0], [10, 5]] }), '<line x1="0" y1="0" x2="10" y2="5"/>');
    assert.equal(inkOf({ type: 'arrow', points: [[0, 0], [100, 0]] }), '<path d="M0 0L100 0M88 7L100 0L88 -7"/>');
    assert.equal(inkOf({ type: 'rect', points: [[50, 40], [10, 20]] }), '<rect x="10" y="20" width="40" height="20" rx="6"/>');
    assert.equal(inkOf({ type: 'ellipse', points: [[10, 20], [50, 40]] }), '<ellipse cx="30" cy="30" rx="20" ry="10"/>');
    assert.equal(inkOf({ type: 'step', points: [[7, 8]], n: 3 }), '<g class="fk-live-step"><circle cx="7" cy="8" r="12"/><text x="7" y="8">3</text></g>');
    assert.equal(inkOf({ type: 'text', points: [[1, 2]], text: 'a<b' }), '<text class="fk-live-ntext" x="1" y="2">a&lt;b</text>');
});

test('stretch keeps a pen\'s points 3px apart and moves a shape\'s end; kept drops a shape that never moved', () => {
    const { stretch, kept } = require('../assets/tune/overlay.js');
    const pen = { type: 'pen', points: [[0, 0]] };
    stretch(pen, 1, 1);
    stretch(pen, 3, 0);
    stretch(pen, 3, 5);
    assert.deepEqual(pen.points, [[0, 0], [3, 0], [3, 5]]);
    const box = { type: 'rect', points: [[0, 0]] };
    stretch(box, 5, 5);
    stretch(box, 9, 4);
    assert.deepEqual(box.points, [[0, 0], [9, 4]]);
    assert.equal(kept(box), true);
    assert.equal(kept({ type: 'line', points: [[2, 2]] }), false);
    assert.equal(kept({ type: 'arrow', points: [[2, 2], [2, 2]] }), false);
    assert.equal(kept({ type: 'step', points: [[2, 2]], n: 1 }), true);
});

test('itemsOf puts the marks, the scroll and the viewport on an item that drew, and none on one that did not', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const p = { block: 'hero', blocks: ['hero'], selector: 'section', classes: [], text: '' };
    const marks = [{ type: 'step', points: [[5, 6]], n: 1 }];
    const got = itemsOf([{ note: 'a', picks: [p], marks }, { note: 'b', picks: [p], marks: [] }], { scroll: [0, 40], viewport: [1280, 800] });
    assert.deepEqual(got[0].marks, marks);
    assert.deepEqual(got[0].scroll, [0, 40]);
    assert.deepEqual(got[0].viewport, [1280, 800]);
    assert.equal('marks' in got[1], false);
    assert.equal('scroll' in got[1], false);
});

test('coral is the ink\'s alone', () => {
    const coral = fs.readFileSync(SRC, 'utf8').split('\n').filter((l) => /ef6f6c/i.test(l));
    assert.ok(coral.length > 0, 'the ink has no coral');
    for (const l of coral) assert.match(l, /^\s*'\.fk-live-(ink|step|ntext|type|inkline)/, 'coral outside the ink: ' + l.trim());
});

test('the pen, a box and steps draw in page coordinates, undo and Ctrl+Z take the last mark back, and the marks go out with the item', async () => {
    const t = loadOverlay();
    t.win.scrollY = 100;
    const down = (x, y) => t.fire(t.page.hero, 'pointerdown', { clientX: x, clientY: y });
    const move = (x, y) => t.fire(t.page.hero, 'pointermove', { clientX: x, clientY: y });
    const up = () => t.fire(t.page.hero, 'pointerup', {});
    t.fire(t.tool('pen'), 'click');
    down(10, 10); move(20, 10); move(20, 30); up();
    const ink = t.q('.fk-live-ink');
    assert.equal(ink.querySelectorAll('polyline').length, 1);
    t.fire(t.page.hero, 'keydown', { key: 'r' });
    down(50, 50); move(90, 80); up();
    down(5, 5); up();
    assert.equal(ink.querySelectorAll('rect').length, 1, 'a box that never moved was kept');
    t.fire(t.page.hero, 'keydown', { key: 'n' });
    down(200, 20); up();
    down(200, 60); up();
    assert.deepEqual(ink.querySelectorAll('text').map((x) => x.textContent), ['1', '2']);
    assert.equal(t.q('.fk-live-inkline').textContent, '標註 4 筆');
    t.fire(t.q('.fk-live-undo'), 'click');
    assert.equal(t.q('.fk-live-inkline').textContent, '標註 3 筆');
    t.fire(t.page.hero, 'keydown', { key: 'z', ctrlKey: true });
    assert.equal(t.q('.fk-live-inkline').textContent, '標註 2 筆');
    t.fire(t.page.hero, 'keydown', { key: 'v' });
    t.fire(t.page.hero, 'click');
    t.fire(t.q('.fk-live-fin'), 'click');
    const area = t.doc.all('textarea').pop();
    area.value = '輸入框太矮';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const item = JSON.parse(t.fetched.find((f) => f.url === '/__live/request').init.body).items[0];
    assert.equal(item.block, 'hero');
    assert.deepEqual(item.marks, [
        { type: 'pen', points: [[10, 110], [20, 110], [20, 130]] },
        { type: 'rect', points: [[50, 150], [90, 180]] },
    ]);
    assert.deepEqual(item.scroll, [0, 100]);
    assert.deepEqual(item.viewport, [1280, 800]);
    await t.tick();
});

test('the text tool asks for words where the press landed; Enter keeps them, Escape drops only the words', () => {
    const t = loadOverlay();
    t.fire(t.tool('text'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 40, clientY: 50 });
    const field = t.q('.fk-live-type');
    assert.ok(field, 'no field for the words');
    assert.equal(field.style.left, '40px');
    assert.equal(t.doc.activeElement, field);
    field.value = '至少三行';
    t.fire(field, 'keydown', { key: 'Enter' });
    assert.equal(t.q('.fk-live-type'), null);
    assert.deepEqual(t.q('.fk-live-ink').querySelectorAll('text').map((x) => x.textContent), ['至少三行']);
    t.fire(t.page.hero, 'pointerdown', { clientX: 60, clientY: 90 });
    const again = t.q('.fk-live-type');
    again.value = '不要';
    t.fire(again, 'keydown', { key: 'Escape' });
    assert.equal(t.q('.fk-live-type'), null);
    assert.equal(t.q('.fk-live-draft').hidden, false, 'Escape in the field closed the item');
    assert.equal(t.q('.fk-live-ink').querySelectorAll('text').length, 1);
});

test('the text field caps its words at 500 characters', () => {
    const t = loadOverlay();
    t.fire(t.tool('text'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 40, clientY: 50 });
    assert.equal(t.q('.fk-live-type').maxLength, 500);
});

test('leaving the text field keeps its words as a mark', () => {
    const t = loadOverlay();
    t.fire(t.tool('text'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 40, clientY: 50 });
    const field = t.q('.fk-live-type');
    field.value = '離開輸入框';
    t.fire(field, 'blur', {});
    assert.equal(t.q('.fk-live-type'), null);
    assert.deepEqual(t.q('.fk-live-ink').querySelectorAll('text').map((x) => x.textContent), ['離開輸入框']);
    assert.equal(t.q('.fk-live-inkline').textContent, '標註 1 筆');
});

test('focus moving from the text field to a button in the card keeps that button, so its click still lands', () => {
    const t = loadOverlay();
    const typeInto = (words) => {
        t.fire(t.page.hero, 'pointerdown', { clientX: 40, clientY: 50 });
        const field = t.q('.fk-live-type');
        field.value = words;
        return field;
    };
    t.fire(t.tool('text'), 'click');
    // The press that moves focus fires blur with the button as relatedTarget,
    // and the click follows on the same node only if it was not rebuilt.
    const field = typeInto('一');
    const undo = t.q('.fk-live-undo');
    assert.equal(undo.disabled, true);
    t.fire(field, 'blur', { relatedTarget: undo });
    assert.equal(t.q('.fk-live-undo'), undo, 'the undo button was rebuilt under the press');
    assert.equal(undo.disabled, false, 'the undo button stayed dead for the mark just kept');
    assert.equal(t.q('.fk-live-ink').querySelectorAll('text').length, 1, 'the words were not drawn');
    t.fire(undo, 'click');
    assert.equal(t.q('.fk-live-ink').querySelectorAll('text').length, 0);
    const again = typeInto('二');
    const fin = t.q('.fk-live-fin');
    t.fire(again, 'blur', { relatedTarget: fin });
    assert.equal(t.q('.fk-live-fin'), fin, '完成這則 was rebuilt under the press');
    t.fire(fin, 'click');
    assert.equal(t.q('.fk-live-draft').hidden, true, 'the click on 完成這則 was lost');
    assert.equal(t.q('.fk-live-count').textContent, '1');
    assert.equal(JSON.parse(t.sessionStorage.m['fk-live-drafts'])[0].marks[0].text, '二');
});

test('resizing the window draws the ink at the page\'s new size', () => {
    const t = loadOverlay();
    t.fire(t.tool('pen'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 0, clientY: 0 });
    t.fire(t.page.hero, 'pointermove', { clientX: 30, clientY: 0 });
    t.fire(t.page.hero, 'pointerup', {});
    const svg = () => t.q('.fk-live-ink').querySelector('svg');
    assert.equal(svg().getAttribute('width'), '1280');
    t.doc.documentElement.scrollWidth = 1700;
    t.doc.documentElement.scrollHeight = 2400;
    for (const l of t.win._on.resize) l.fn({});
    assert.equal(svg().getAttribute('width'), '1700');
    assert.equal(svg().getAttribute('height'), '2400');
});

test('taking the last chip off an item that has marks keeps the item; with no marks it goes', () => {
    const t = loadOverlay();
    t.fire(t.tool('pen'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 0, clientY: 0 });
    t.fire(t.page.hero, 'pointermove', { clientX: 30, clientY: 0 });
    t.fire(t.page.hero, 'pointerup', {});
    t.fire(t.page.hero, 'keydown', { key: 'v' });
    t.fire(t.page.hero, 'click');
    t.fire(t.q('.fk-live-fin'), 'click');
    t.fire(t.q('.fk-live-chip').querySelector('button'), 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 0);
    assert.equal(t.q('.fk-live-count').textContent, '1', 'an item with marks went when its last chip did');
    assert.equal(t.q('.fk-live-inkline').textContent, '標註 1 筆');
    t.draft(['card'], 'x');
    assert.equal(t.q('.fk-live-count').textContent, '2');
    t.fire(t.doc.all('.fk-live-chip')[0].querySelector('button'), 'click');
    assert.equal(t.q('.fk-live-count').textContent, '1', 'an item with no marks stayed with no element');
});

test('an item that drew but picked no element is kept, and 全部送出 says which one still needs an element', () => {
    const t = loadOverlay();
    t.fire(t.tool('pen'), 'click');
    t.fire(t.page.hero, 'pointerdown', { clientX: 0, clientY: 0 });
    t.fire(t.page.hero, 'pointermove', { clientX: 30, clientY: 0 });
    t.fire(t.page.hero, 'pointerup', {});
    t.fire(t.q('.fk-live-fin'), 'click');
    assert.equal(t.q('.fk-live-count').textContent, '1', 'an item with marks and no element was thrown away');
    const area = t.doc.all('textarea').pop();
    area.value = '這裡';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    assert.equal(t.fetched.filter((f) => f.url === '/__live/request').length, 0);
    assert.equal(t.q('.fk-live-queue').querySelector('span').textContent, '第 1 則還沒選元素');
});

test('the marks are saved with the drafts and drawn again on a fresh page; Escape on a re-opened item puts its marks back', () => {
    const a = loadOverlay();
    a.fire(a.tool('pen'), 'click');
    a.fire(a.page.hero, 'keydown', { key: 'l' });
    a.fire(a.page.hero, 'pointerdown', { clientX: 0, clientY: 0 });
    a.fire(a.page.hero, 'pointermove', { clientX: 40, clientY: 0 });
    a.fire(a.page.hero, 'pointerup', {});
    a.fire(a.page.hero, 'keydown', { key: 'v' });
    a.fire(a.page.hero, 'click');
    a.fire(a.q('.fk-live-fin'), 'click');
    const saved = JSON.parse(a.sessionStorage.m['fk-live-drafts']);
    assert.deepEqual(saved[0].marks, [{ type: 'line', points: [[0, 0], [40, 0]] }]);
    const b = loadOverlay({ sessionStorage: a.sessionStorage });
    assert.equal(b.q('.fk-live-ink').querySelectorAll('line').length, 1);
    b.openTray();
    b.fire(b.q('.fk-live-num'), 'click');
    b.fire(b.page.hero, 'keydown', { key: 'z', ctrlKey: true });
    assert.equal(b.q('.fk-live-ink').querySelectorAll('line').length, 0);
    b.fire(b.page.hero, 'keydown', { key: 'Escape' });
    assert.equal(b.q('.fk-live-ink').querySelectorAll('line').length, 1, 'Escape did not put the undone mark back');
});

test('the design skill and the mockup agent say how to read an item\'s marks', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\s+/g, ' ');
    assert.match(read('skills/fankeel-design/SKILL.md'), /An item may carry `marks`/);
    assert.match(read('agents/fankeel-mockup.md'), /An item may also carry `marks`/);
});

test('roomFor allows a mark while all drafts weigh 6000 or less (points + 4 + text), across drafts, and again once marks are removed', () => {
    const { roomFor } = require('../assets/tune/overlay.js');
    const pts = (n) => Array.from({ length: n }, (_, i) => [i, i]);
    const b = { marks: [{ type: 'pen', points: pts(496) }] };
    assert.equal(roomFor([b], { type: 'pen', points: pts(496) }), true);
    const full = { marks: Array.from({ length: 10 }, () => ({ type: 'pen', points: pts(496) })) };
    assert.equal(roomFor([full, b], { type: 'pen', points: pts(496) }), true, 'exactly 6000 fits');
    assert.equal(roomFor([full, b], { type: 'step', points: pts(1) }), true, 'a step weighs 5, 5505 fits');
    full.marks.push({ type: 'pen', points: pts(496) });
    assert.equal(roomFor([full, b], { type: 'step', points: pts(1) }), false, 'the total across two drafts passes 6000');
    full.marks.pop();
    assert.equal(roomFor([full, b], { type: 'pen', points: pts(496) }), true);
});

test('a text mark weighs its length toward the cap', () => {
    const { roomFor } = require('../assets/tune/overlay.js');
    const d = { marks: Array.from({ length: 11 }, () => ({ type: 'text', points: [[0, 0]], text: 'x'.repeat(495) })) };
    assert.equal(roomFor([d], { type: 'step', points: [[0, 0]] }), true, '11*500 + 5 fits');
    d.marks.push({ type: 'text', points: [[0, 0]], text: 'x'.repeat(496) });
    assert.equal(roomFor([d], { type: 'step', points: [[0, 0]] }), false, '6001 + 5 does not');
    assert.equal(roomFor([{ marks: [] }], { type: 'text', points: [[0, 0]], text: 'x'.repeat(500) }), true);
});

test('a draft holding 100 marks refuses the 101st', () => {
    const { roomFor } = require('../assets/tune/overlay.js');
    const d = { marks: Array.from({ length: 99 }, () => ({ type: 'step', points: [[0, 0]] })) };
    assert.equal(roomFor([d], { type: 'step', points: [[0, 0]] }, d), true);
    d.marks.push({ type: 'step', points: [[0, 0]] });
    assert.equal(roomFor([d], { type: 'step', points: [[0, 0]] }, d), false);
});

test('a mark past the 6000-weight cap is not kept and the draft line says so', () => {
    const t = loadOverlay();
    const down = (x, y) => t.fire(t.page.hero, 'pointerdown', { clientX: x, clientY: y });
    const move = (x, y) => t.fire(t.page.hero, 'pointermove', { clientX: x, clientY: y });
    const up = () => t.fire(t.page.hero, 'pointerup', {});
    t.fire(t.tool('pen'), 'click');
    for (let k = 0; k < 12; k++) {
        down(0, 0);
        for (let i = 1; i < 496; i++) move(i * 3, 0);
        up();
    }
    t.fire(t.page.hero, 'keydown', { key: 'n' });
    down(200, 20); up();
    assert.equal(t.q('.fk-live-ink').querySelectorAll('circle').length, 0, 'a step past the cap was kept');
    assert.equal(t.q('.fk-live-say').textContent, '標註已達上限，先送出再繼續畫');
});

// tune-9: a note stops at the server's 4000 characters, and a send the server
// would refuse with 413 is held back with its size and what to do.
test('a note field stops at the server\'s 4000 characters, and bytesOf counts UTF-8', () => {
    const { bytesOf, NOTE_MAX, BODY_MAX } = require('../assets/tune/overlay.js');
    assert.equal(NOTE_MAX, 4000);
    assert.equal(BODY_MAX, 262144);
    assert.equal(bytesOf('ab'), 2);
    assert.equal(bytesOf('é'), 2);
    assert.equal(bytesOf('字'), 3);
    assert.equal(bytesOf('😀'), 4);
    const t = loadOverlay();
    t.openTray();
    const area = t.draft(['hero'], 'x');
    assert.equal(area.maxLength, 4000);
});

test('a send past 256 KB is held back with the size and what to do, and nothing is posted', async () => {
    const t = loadOverlay();
    t.openTray();
    for (let i = 0; i < 22; i++) t.draft(['hero'], '字'.repeat(4000));
    t.fire(t.q('.fk-live-all'), 'click');
    assert.equal(t.fetched.filter((f) => f.url === '/__live/request').length, 0, 'a body past 256 KB was posted');
    assert.match(t.q('.fk-live-queue').querySelector('span').textContent, /^這次共 \d+ KB，超過一次能送的 256 KB；刪掉幾則或縮短備註再送$/);
    assert.equal(t.q('.fk-live-count').textContent, '22', 'the drafts were dropped');
    await t.tick();
});
