// Task 7 Step 2: is the question the user saw the stage agent's gate block, word for word?
// usage: node artefact-check.js <session id> <handoff file>
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readGate } = require('../../../../lib/handoff.js');

const [session, handoff] = process.argv.slice(2);
const transcript = path.join(os.homedir(), '.claude', 'projects', 'F--ymlab-fankeel', session + '.jsonl');
const gate = readGate(handoff);
console.log('transcript: ' + transcript);
console.log('handoff:    ' + handoff);
console.log('gate block: ' + (gate ? gate.questions.length + ' question(s), next = ' + JSON.stringify(gate.next) : 'NONE'));

const asks = new Set();
for (const line of fs.readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }
    const content = o.message && Array.isArray(o.message.content) ? o.message.content : [];
    for (const c of content) {
        if (c.type === 'tool_use' && c.name === 'AskUserQuestion') {
            asks.add(c.id);
            console.log('\nsent by the controller (tool_use.input.questions):');
            console.log('  ' + JSON.stringify(c.input.questions));
            console.log('  equals gate block: ' + (gate && JSON.stringify(c.input.questions) === JSON.stringify(gate.questions)));
        }
        if (c.type === 'tool_result' && asks.has(c.tool_use_id) && o.toolUseResult) {
            const shown = o.toolUseResult.questions;
            console.log('shown to the user (toolUseResult.questions):');
            console.log('  ' + JSON.stringify(shown));
            console.log('  equals gate block: ' + (gate && JSON.stringify(shown) === JSON.stringify(gate.questions)));
            console.log('  answers: ' + JSON.stringify(o.toolUseResult.answers));
        }
    }
}
if (!asks.size) console.log('\nno AskUserQuestion in the transcript');
