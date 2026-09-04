'use strict';
// What a session's transcript says it spent, summed once at the end of the
// session rather than on every prompt — `lib/context.js` reads a tail sixty
// times an hour; this reads the whole file once, when nothing is waiting on it.
//
// Every `type: "assistant"` line carries `message.model` and `message.usage`.
// One request writes several such lines with the same usage on each: measured
// 2026-09-04, 76 assistant lines for 25 `requestId`s, one of them six times
// with `output_tokens: 1061` on every copy. Summing lines over-counts
// threefold, so the sum is over distinct `requestId`, last line winning. A line
// with no `requestId` at all is counted on its own — there is nothing to
// de-duplicate it against.
//
// Cache writes arrive split by TTL under `cache_creation` on current
// transcripts, and as one `cache_creation_input_tokens` figure on older ones;
// the undivided figure is counted as five-minute writes, the cheaper rate.
const fs = require('node:fs');

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function summarise(transcriptPath) {
    let text;
    try {
        text = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }
    const byRequest = new Map();
    let anonymous = 0;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!entry || entry.type !== 'assistant' || entry.isSidechain === true) continue;
        const message = entry.message;
        if (!message || typeof message !== 'object') continue;
        if (typeof message.model !== 'string' || !message.usage || typeof message.usage !== 'object') continue;
        const key = typeof entry.requestId === 'string' && entry.requestId
            ? entry.requestId
            : 'anonymous-' + (anonymous++);
        byRequest.set(key, { model: message.model, usage: message.usage });
    }
    if (!byRequest.size) return null;

    const models = {};
    for (const { model, usage } of byRequest.values()) {
        const m = models[model] || (models[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
        m.input += num(usage.input_tokens);
        m.output += num(usage.output_tokens);
        m.cacheRead += num(usage.cache_read_input_tokens);
        const split = usage.cache_creation;
        if (split && typeof split === 'object') {
            m.cacheWrite5m += num(split.ephemeral_5m_input_tokens);
            m.cacheWrite1h += num(split.ephemeral_1h_input_tokens);
        } else {
            m.cacheWrite5m += num(usage.cache_creation_input_tokens);
        }
    }
    let model = null;
    for (const id of Object.keys(models)) {
        if (model === null || models[id].output > models[model].output) model = id;
    }
    return { model, usage: { requests: byRequest.size, models } };
}

module.exports = { summarise };
