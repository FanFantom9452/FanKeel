'use strict';

// One POST body, as a string, capped.
//
// `scripts/tune.js` and `scripts/station.js` each read one, and past the cap
// they did different things on purpose: tune drops the connection without a
// reply, station keeps what it has and answers anyway. `destroyOnOverflow`
// keeps both rather than choosing for either.

function readBody(req, { max = 65536, destroyOnOverflow = false } = {}) {
    return new Promise((resolve) => {
        let text = '';
        req.setEncoding('utf8');
        req.on('data', (c) => {
            if (destroyOnOverflow) {
                text += c;
                if (text.length > max) req.destroy();
            } else if (text.length < max) {
                text += c;
            }
        });
        req.on('end', () => resolve(text));
        req.on('error', () => resolve(''));
    });
}

module.exports = { readBody };
