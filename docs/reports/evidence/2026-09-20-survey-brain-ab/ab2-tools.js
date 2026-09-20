// ab2: where each transcript's time went — tool calls, Bash calls, and the seconds
// between its first and last timestamp, and the main session's Bash commands, cut at 160
// characters. Arms and sessions come from <dir>/provenance.txt.
// usage: node ab2-tools.js [dir] — defaults to ab2/
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = path.join(os.homedir(), '.claude', 'projects', 'F--ymlab-fankeel');
const log = fs.readFileSync(path.join(__dirname, process.argv[2] || 'ab2', 'provenance.txt'), 'utf8');
function tally(file) {
    let tools = 0, ranged = 0, first = null, last = null;
    const by = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        let o; try { o = JSON.parse(line); } catch (e) { continue; }
        if (o.timestamp) { const t = Date.parse(o.timestamp); if (first === null) first = t; last = t; }
        if (o.type !== 'assistant' || !o.message) continue;
        for (const b of o.message.content || []) if (b.type === 'tool_use') { tools++; by[b.name] = (by[b.name] || 0) + 1; if (b.name === 'Read' && (b.input.offset != null || b.input.limit != null)) ranged++; if (b.name === 'Bash') { commands.push(String(b.input.command).replace(/\n/g, ' ').slice(0, 160)); } }
    }
    return 'tool calls ' + tools + ' (' + Object.entries(by).map(([k, n]) => k + ' ' + n).join(', ') + (ranged ? '; Read with a line range ' + ranged : '') + '), first to last timestamp ' + Math.round((last - first) / 1000) + 's';
}
let commands = [];
for (const m of log.matchAll(/^--- (\S+) .*session ([0-9a-f-]{36})$/gm)) {
    commands = [];
    console.log(m[1] + '  main: ' + tally(path.join(P, m[2] + '.jsonl')));
    for (const c of commands) console.log('    $ ' + c);
    const sub = path.join(P, m[2], 'subagents');
    let names = [];
    try { names = fs.readdirSync(sub).filter((n) => /^agent-[0-9a-f]+\.jsonl$/.test(n)); } catch (e) { /* none */ }
    for (const n of names) {
        const meta = JSON.parse(fs.readFileSync(path.join(sub, n.replace('.jsonl', '.meta.json')), 'utf8'));
        console.log('    ' + meta.agentType + ': ' + tally(path.join(sub, n)));
    }
}
