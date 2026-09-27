'use strict';
// A 2D context that draws nothing. Every method call and property write is
// recorded in `calls`, in order, so a frame can be compared with itself and
// the text it printed read back with `texts()`. Properties written are kept,
// so `ctx.globalAlpha` reads back; save() and restore() stack them.

function fakeCtx(width, height) {
    const calls = [];
    const stack = [];
    let state = { globalAlpha: 1, font: '10px sans-serif', fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1 };
    const own = {
        canvas: { width: width || 1280, height: height || 720 },
        calls,
        texts: () => calls.filter((c) => c[0] === 'fillText').map((c) => c[1]),
        measureText: (s) => ({ width: String(s).length * 7 }),
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

module.exports = { fakeCtx, fakeCanvas };
