'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'stop.js');
const MANIFEST = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
const SID = 'aaaaaaaa-0000-4000-8000-0000000000f2';

function project(active, profileJson) {
    const root = tmp('fankeel-phone-stop-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        task: 't', claims: [], stage: 'build', active, started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString(),
    }));
    if (profileJson) fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify(profileJson));
    const transcript = path.join(root, 'transcript.jsonl');
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '等一下' }] } }) + '\n');
    return { root, transcript };
}
const input = (p, extra) => JSON.stringify(Object.assign({
    session_id: SID, cwd: p.root, hook_event_name: 'Stop', stop_hook_active: false, transcript_path: p.transcript,
    last_assistant_message: 'done', background_tasks: [],
}, extra));
const env = (p) => Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: p.root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') });
const fire = (p, extra) => execFileSync(process.execPath, [HOOK], { input: input(p, extra), encoding: 'utf8', env: env(p) });
const exists = (p, name) => fs.existsSync(path.join(phone.dirOf(p.root, SID), name));

test('attached with a message waiting: the Stop blocks with the phone text, even after a block', () => {
    const p = project(false);
    phone.attach(p.root, SID, 'my-pc', 1);
    phone.say(p.root, SID, '跑吧', 2);
    const out = JSON.parse(fire(p, { stop_hook_active: true }));
    assert.deepEqual(out, { decision: 'block', reason: '（手機）跑吧' });
    assert.equal(exists(p, 'inbox.json'), false);
    assert.equal(exists(p, 'holding.json'), false);
    assert.deepEqual(phone.chat(p.root, SID, 0).map((x) => [x.role, x.text]), [['assistant', 'done'], ['phone', '跑吧']]);
});

test('not attached: nothing printed, the reply and the background list recorded, [] clears it', () => {
    const p = project(false);
    const item = { id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' };
    assert.equal(fire(p, { background_tasks: [item] }), '');
    assert.equal(phone.chat(p.root, SID, 1)[0].role, 'assistant');
    assert.deepEqual(phone.background(p.root, SID).map((x) => x.id), ['b1']);
    fire(p, { background_tasks: [] });
    assert.deepEqual(phone.background(p.root, SID), []);
});

test('phone.hold runs out: nothing printed and the phone is detached', () => {
    const p = project(false, { 'phone.hold': 1 });
    phone.attach(p.root, SID, 'my-pc', 1);
    const t0 = Date.now();
    assert.equal(fire(p), '');
    assert.ok(Date.now() - t0 >= 900);
    assert.equal(exists(p, 'attach.json'), false);
});

test('a hold that throws ends the Stop with the phone detached', () => {
    const p = project(false);
    phone.attach(p.root, SID, 'my-pc', 1);
    // A directory where holding.json goes: hold's first write throws.
    fs.mkdirSync(path.join(phone.dirOf(p.root, SID), 'holding.json'));
    assert.equal(fire(p), '');
    assert.equal(exists(p, 'attach.json'), false);
});

test('a detach while holding releases the hook with nothing printed', async () => {
    const p = project(false);
    phone.attach(p.root, SID, 'my-pc', 1);
    const child = spawn(process.execPath, [HOOK], { env: env(p) });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stdin.end(input(p));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(exists(p, 'holding.json'), true);
    phone.detach(p.root, SID);
    await new Promise((r) => child.on('close', r));
    assert.equal(out, '');
    assert.equal(exists(p, 'attach.json'), false);
    assert.equal(exists(p, 'holding.json'), false);
});

test('the refusal still wins over the phone, and leaves the message waiting', () => {
    const p = project(true);
    phone.attach(p.root, SID, 'my-pc', 1);
    phone.say(p.root, SID, '跑吧', 2);
    const out = JSON.parse(fire(p));
    assert.match(out.reason, /build is open/);
    assert.equal(exists(p, 'inbox.json'), true);
});

test('the manifest gives the Stop hook 1805 seconds', () => {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const h = m.hooks.Stop.flatMap((x) => x.hooks).find((x) => /hooks\/stop\.js/.test(x.command));
    assert.equal(h.timeout, 1805);
});
