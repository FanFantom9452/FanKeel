// Task 7: the main session's context at its last turn, and the tokens each transcript
// (main, and each subagent) consumed. Context = input + cache read + cache write of
// the last assistant message in the main transcript.
// usage: node ab-context.js [dir] — with a dir, the arms and sessions come from its provenance.txt
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = path.join(os.homedir(), '.claude', 'projects', 'F--ymlab-fankeel');
const ARMS = process.argv[2] ? fromLog(path.join(__dirname, process.argv[2], 'provenance.txt')) : { old1: '862d2d16-5f24-46fe-ae46-10cdb7f8c74e', new1: '3b86035f-a9e0-4729-b392-184c1d4c1889', old2: 'c7788483-59f5-464c-b491-80446709676e', new2: '3298a25a-4840-43f7-a6ce-79a981729057', interactive: '942566e9-d4f1-43f7-887c-78e8090ee78c' };
function fromLog(file) {
    const out = {};
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/^--- (\S+) .*session ([0-9a-f-]{36})$/gm)) out[m[1]] = m[2];
    return out;
}
function scan(file) {
    let last = null, out = 0, model = null;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        let o; try { o = JSON.parse(line); } catch (e) { continue; }
        const m = o.message;
        if (o.type === 'assistant' && m && m.usage) { last = m.usage; out += m.usage.output_tokens || 0; model = m.model || model; }
    }
    const ctx = last ? (last.input_tokens || 0) + (last.cache_read_input_tokens || 0) + (last.cache_creation_input_tokens || 0) : 0;
    return { ctx, out, model };
}
for (const [arm, s] of Object.entries(ARMS)) {
    const main = scan(path.join(P, s + '.jsonl'));
    console.log(arm + '  main (' + main.model + '): context at last turn ' + main.ctx + ', output ' + main.out);
    const sub = path.join(P, s, 'subagents');
    let names = [];
    try { names = fs.readdirSync(sub).filter((n) => /^agent-[0-9a-f]+\.jsonl$/.test(n)); } catch (e) { /* none */ }
    for (const n of names) {
        const meta = JSON.parse(fs.readFileSync(path.join(sub, n.replace('.jsonl', '.meta.json')), 'utf8'));
        const r = scan(path.join(sub, n));
        console.log('    ' + meta.agentType + ' depth ' + meta.spawnDepth + ' (' + r.model + '): context at last turn ' + r.ctx + ', output ' + r.out);
    }
}
