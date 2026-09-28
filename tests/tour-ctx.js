'use strict';
// A 2D context that draws nothing. Every method call and property write is
// recorded in `calls`, in order, so a frame can be compared with itself and
// the text it printed read back with `texts()`. Properties written are kept,
// so `ctx.globalAlpha` reads back; save() and restore() stack them.
//
// measureText reads the size off the font last set and answers the way the
// faces the frames name are built: a CJK or full-width character is one em
// (JhengHei's are), an ASCII one is 0.6 em in a mono face (Cascadia Mono is
// 0.586) and 0.56 em otherwise. The ink box is 0.72 em above the baseline and
// 0.2 em below. Close enough to find a string that does not fit; the page's
// ?check measures with the real faces.
const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿]/;

function fakeCtx(width, height) {
    const calls = [];
    const stack = [];
    let state = { globalAlpha: 1, font: '10px sans-serif', fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1 };
    const own = {
        canvas: { width: width || 1280, height: height || 720 },
        calls,
        texts: () => calls.filter((c) => c[0] === 'fillText').map((c) => c[1]),
        measureText: (s) => {
            const m = /(\d+(?:\.\d+)?)px\s+(.*)$/.exec(state.font);
            const size = m ? Number(m[1]) : 10;
            const ascii = m && /^"?Cascadia Mono/.test(m[2]) ? 0.6 : 0.56;
            let w = 0;
            for (const ch of String(s)) w += WIDE.test(ch) ? size : size * ascii;
            return { width: w, actualBoundingBoxAscent: 0.72 * size, actualBoundingBoxDescent: 0.2 * size };
        },
        save: () => { calls.push(['save']); stack.push(Object.assign({}, state)); },
        restore: () => { calls.push(['restore']); if (stack.length) state = stack.pop(); },
    };
    return new Proxy(own, {
        get(t, k) {
            if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
            if (Object.prototype.hasOwnProperty.call(state, k)) return state[k];
            return (...args) => { calls.push([String(k), ...args]); };
        },
        set(t, k, v) {
            state[k] = v;
            calls.push(['=' + String(k), v]);
            return true;
        },
    });
}

function fakeCanvas() {
    const ctx = fakeCtx();
    return { width: 0, height: 0, getContext: () => ctx };
}

// Draws `draw(ctx, f)` on a fresh fake context at every frame in `frames`
// with tour.js's fit log on (T is tour.js). Returns what the frames' tests
// ask of all of them at once: every fit entry, every fillText set in the
// mono face that holds a character outside printable ASCII, and every frame
// that drew with a number that is not finite.
function sweep(T, frames, draw) {
    const log = [], monoWide = [], nonFinite = [];
    const was = T.fitLog(log);
    try {
        for (const f of frames) {
            const ctx = fakeCtx();
            draw(ctx, f);
            let font = '';
            for (const c of ctx.calls) {
                if (c[0] === '=font') font = c[1];
                if (c[0] === 'fillText' && /px "Cascadia Mono"/.test(font) && /[^\x20-\x7e]/.test(c[1])) monoWide.push(f + ': ' + c[1]);
                if (c.some((x) => typeof x === 'number' && !Number.isFinite(x))) nonFinite.push(f);
            }
        }
    } finally {
        T.fitLog(was);
    }
    return { log, monoWide, nonFinite };
}

module.exports = { fakeCtx, fakeCanvas, sweep };
