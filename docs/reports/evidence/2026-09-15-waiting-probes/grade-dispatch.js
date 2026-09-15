// Reads the five stream-json transcripts probe-dispatch.sh wrote and says,
// per arm, every tool the model actually called — so a dispatch is read off
// the tool_use block's own name rather than off what the model claims.
//
// dis-agent is the control. Until an arm is shown that does NOT dispatch,
// every other arm is consistent with "this harness cannot remove the tool".
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: grade-dispatch.js <dir>'); process.exit(2); }

const ARMS = ['agent', 'task', 'none', 'dis-agent', 'dis-task'];
const FLAG = {
    agent: '--allowedTools ...,Agent',
    task: '--allowedTools ...,Task',
    none: '--allowedTools ... (neither)',
    'dis-agent': '--disallowedTools Agent',
    'dis-task': '--disallowedTools Task',
};
const DISPATCH = new Set(['Agent', 'Task']);

function toolsIn(file) {
    if (!fs.existsSync(file)) return null;
    const names = [];
    let refusal = false;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const content = msg && msg.message && msg.message.content;
        if (!Array.isArray(content)) continue;
        for (const b of content) {
            if (b.type === 'tool_use') names.push(b.name);
            // assistant only, for the same reason grade-link.js is: a text
            // block from any other role is injected material, not the model
            // answering. It does not change this grader's verdict -- CONTROL
            // and gates() read tool_use.name, a structural field -- but the
            // report quotes `refusal` as evidence, so it has to mean what it says.
            if (b.type === 'text' && msg.type === 'assistant'
                && /NO DISPATCH TOOL/.test(b.text || '')) refusal = true;
        }
    }
    return { names, refusal };
}

const seen = {};
for (const arm of ARMS) {
    // Two names, because the transcripts carry one in each place they live:
    // `dispatch-out-<arm>.jsonl` here in the evidence directory, where they were
    // prefixed so as not to collide with the deny probe's own `out-*.jsonl`, and
    // `out-<arm>.jsonl` in the throwaway directory probe-dispatch.sh wrote them
    // to. Graded from the second and shipped beside the first, this opened
    // neither and printed NO TRANSCRIPT five times -- a grader that cannot read
    // its own evidence is one nobody re-runs.
    const r = toolsIn(path.join(dir, 'dispatch-out-' + arm + '.jsonl'))
        || toolsIn(path.join(dir, 'out-' + arm + '.jsonl'));
    if (!r) { console.log(arm.padEnd(11) + 'NO TRANSCRIPT'); continue; }
    const dispatched = r.names.filter((n) => DISPATCH.has(n));
    seen[arm] = { dispatched, names: r.names, refusal: r.refusal };
    console.log(arm.padEnd(11) + FLAG[arm].padEnd(30)
        + (dispatched.length
            ? 'DISPATCHED as ' + [...new Set(dispatched)].join('/')
            : 'no dispatch')
        + (r.refusal ? '  [said NO DISPATCH TOOL]' : ''));
}

console.log('');
if (!seen['dis-agent']) { console.log('CONTROL MISSING — dis-agent has no transcript.'); process.exit(1); }
if (seen['dis-agent'].dispatched.length) {
    console.log('CONTROL FAILED — every arm dispatched, dis-agent included. Nothing here can');
    console.log('remove the tool, so no arm says anything about a flag or a spelling.');
    process.exit(1);
}
console.log('control held: --disallowedTools Agent removed the tool.');

const gates = (arm) => seen[arm] && seen[arm].dispatched.length === 0;
console.log('--allowedTools gates Agent: ' + (gates('none') ? 'yes' : 'NO — the arm allowing neither spelling still dispatched'));
console.log('--disallowedTools Task also removes it: ' + (gates('dis-task') ? 'yes — both spellings work' : 'no — only Agent is the name that matches'));
