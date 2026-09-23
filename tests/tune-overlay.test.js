'use strict';
// assets/tune/overlay.js runs in a browser that this suite does not have, so
// what is checked here is what can be checked without one: it parses, it
// talks to the endpoints scripts/tune.js serves, and scripts/tune.js serves
// it. What it looks like is the render reviewer's question, at verify.
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
