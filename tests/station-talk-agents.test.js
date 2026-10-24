'use strict';
// serve's talk route with tool calls and sub-agents (lib/talkacts.js): the
// page's act turns with each dispatch linked to its transcript, the live
// states at /station/talk/<id>/agents, and one sub-agent's own transcript at
// /station/talk/<id>/agent/<agentId>.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const T = (s) => '2026-10-24T01:00:' + String(s).padStart(2, '0') + '.000Z';
const now = () => new Date().toISOString();
const jsonl = (lines) => lines.map((l) => JSON.stringify(l) + '\n').join('');
const user = (content, at, extra) => Object.assign({ type: 'user', timestamp: at, message: { role: 'user', content } }, extra);
const said = (id, content, at, extra) => Object.assign({ type: 'assistant', timestamp: at, message: { id, model: 'claude-opus-5-5', content } }, extra);
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const SIDE = { isSidechain: true };

const MAIN = [
    user('fix it', T(1)),
    said('m1', [{ type: 'text', text: 'Looking.' }], T(2)),
    said('m1', [use('tu_b', 'Bash', { command: 'npm test' })], T(2)),
    user([{ type: 'tool_result', tool_use_id: 'tu_b', content: 'ok' }], T(3)),
    said('m2', [use('tu_a', 'Agent', { description: 'review the diff', subagent_type: 'fankeel:fankeel-reviewer', model: 'opus', prompt: 'p' })], T(4)),
    said('m2', [use('tu_x', 'Agent', { description: 'read the map', subagent_type: 'Explore', prompt: 'p' })], T(4)),
    user([{ type: 'tool_result', tool_use_id: 'tu_a', content: 'All good.' }], T(6), { toolUseResult: { agentId: 'a1', status: 'completed' } }),
];
// a1 answered; a3 is mid-call (its last line a tool_use, its file fresh).
const A1 = [
    user('Review this diff.', now(), SIDE),
    said('s1', [use('r1', 'Read', { file_path: 'lib/x.js' })], now(), SIDE),
    user([{ type: 'tool_result', tool_use_id: 'r1', content: 'z'.repeat(3000) }], now(), SIDE),
    said('s2', [{ type: 'text', text: 'All good: no findings.' }], now(), SIDE),
];
const A3 = [user('Read the map.', now(), SIDE), said('s3', [use('g1', 'Grep', { pattern: 'turnsOf' })], now(), SIDE)];

function fixture() {
    const base = tmp('fankeel-station-talk-agents-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    const sub = path.join(proj, SID, 'subagents');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(sub, { recursive: true });
    registry.ensureLayout(r1);
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), jsonl(MAIN));
    fs.writeFileSync(path.join(sub, 'agent-a1.jsonl'), jsonl(A1));
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-reviewer', description: 'review the diff', model: 'opus', toolUseId: 'tu_a' }));
    fs.writeFileSync(path.join(sub, 'agent-a3.jsonl'), jsonl(A3));
    fs.writeFileSync(path.join(sub, 'agent-a3.meta.json'), JSON.stringify({ agentType: 'Explore', description: 'read the map', toolUseId: 'tu_x' }));
    return { cfg, r1 };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('the talk page carries an act turn with its tools and each dispatch linked, and the counts are unchanged', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const page = JSON.parse((await get(s.url + 'station/talk/' + SID)).text);
        assert.deepEqual(page.turns.map((t) => t.kind), ['user', 'claude', 'act']);
        assert.deepEqual([page.total, page.counts], [3, { compact: 0, user: 1, claude: 1 }]);
        const act = page.turns[2];
        assert.deepEqual(act.tools.map((t) => [t.name, t.brief]), [['Bash', 'npm test']]);
        assert.deepEqual(act.agents.map((a) => [a.id, a.agentId, a.state, a.agentType, a.model]), [
            ['tu_a', 'a1', 'finished', 'fankeel:fankeel-reviewer', 'opus'],
            ['tu_x', 'a3', 'running', 'Explore', null],
        ]);
    } finally {
        s.close();
    }
});

test('/agents answers every dispatch\'s live state, and one that stopped running turns finished', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/talk/' + SID + '/agents');
        assert.equal(ok.status, 200);
        assert.equal(ok.headers['cache-control'], 'no-store');
        assert.deepEqual(JSON.parse(ok.text), { agents: [{ id: 'tu_a', agentId: 'a1', state: 'finished' }, { id: 'tu_x', agentId: 'a3', state: 'running' }] });
        const file = path.join(f.cfg, 'projects', 'ws-slug', SID, 'subagents', 'agent-a3.jsonl');
        fs.appendFileSync(file, jsonl([said('s4', [{ type: 'text', text: 'Map read.' }], now(), SIDE)]));
        assert.deepEqual(JSON.parse((await get(s.url + 'station/talk/' + SID + '/agents')).text).agents[1], { id: 'tu_x', agentId: 'a3', state: 'finished' });
    } finally {
        s.close();
    }
});

test('/agents follows a dispatch back to running when its file is live again and the cache key is unchanged', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const sub = path.join(f.cfg, 'projects', 'ws-slug', SID, 'subagents');
        // detail.keyOf holds the newest mtime and the summed size: a1 ahead of
        // now keeps the key still while a3 goes from quiet to live.
        const ahead = Date.now() / 1000 + 3600;
        fs.utimesSync(path.join(sub, 'agent-a1.jsonl'), ahead, ahead);
        const quiet = Date.now() / 1000 - 3600;
        fs.utimesSync(path.join(sub, 'agent-a3.jsonl'), quiet, quiet);
        const state = async (tail) => JSON.parse((await get(s.url + 'station/talk/' + SID + tail)).text);
        assert.equal((await state('/agents')).agents[1].state, 'finished');
        assert.equal((await state('')).turns[2].agents[1].state, 'finished');
        const live = Date.now() / 1000;
        fs.utimesSync(path.join(sub, 'agent-a3.jsonl'), live, live);
        assert.equal((await state('/agents')).agents[1].state, 'running');
        assert.equal((await state('')).turns[2].agents[1].state, 'running');
    } finally {
        s.close();
    }
});

test('/agent/<id> answers one sub-agent\'s transcript, its state and its final report; an unknown agent is a 404', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/talk/' + SID + '/agent/a1');
        assert.equal(ok.status, 200);
        const v = JSON.parse(ok.text);
        assert.deepEqual([v.id, v.description, v.agentType, v.model, v.state], ['a1', 'review the diff', 'fankeel:fankeel-reviewer', 'opus', 'finished']);
        assert.deepEqual(v.turns.map((t) => t.kind), ['user', 'tool', 'result', 'claude']);
        assert.deepEqual([v.turns[1].name, v.turns[1].brief], ['Read', 'lib/x.js']);
        assert.deepEqual([v.turns[2].text.length, v.turns[2].cut], [2000, true]);
        assert.equal(v.report, 'All good: no findings.');
        const run = JSON.parse((await get(s.url + 'station/talk/' + SID + '/agent/a3')).text);
        assert.deepEqual([run.state, run.report], ['running', null]);
        assert.equal((await get(s.url + 'station/talk/' + SID + '/agent/ffff')).status, 404);
    } finally {
        s.close();
    }
});
