// Reads the four link-probe transcripts and reports, per cell and run, two
// independent signals:
//
//   read   — did the model open rationale.md with a tool? Direct evidence the
//            relative link was followed, independent of what it then said.
//   quoted — did the answer carry the sentence the needle lives in? A model
//            can reproduce a sentence without opening anything, so this alone
//            is weaker than the tool call; together they separate
//            "followed the link" from "guessed".
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: grade-link.js <dir>'); process.exit(2); }

// The exact fragments, from the two files, each unique to its own.
const FRAGMENT = { control: 'predating', linked: 'triples', sonnet: 'triples' };
const SENTENCE = {
    control: 'orphan predating this task',
    linked: 'quietly triples',
    sonnet: 'quietly triples',
};

const CELLS = [['control', 1], ['control', 2], ['linked', 1], ['linked', 2], ['sonnet', 1], ['sonnet', 2]];

function readRun(file) {
    if (!fs.existsSync(file)) return null;
    let openedRationale = false;
    let openedSkill = false;
    let invokedSkill = false;
    const texts = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const content = msg && msg.message && msg.message.content;
        if (!Array.isArray(content)) continue;
        for (const b of content) {
            if (b.type === 'tool_use') {
                if (b.name === 'Skill') invokedSkill = true;
                const arg = JSON.stringify(b.input || {});
                if (/rationale\.md/.test(arg)) openedRationale = true;
                if (/SKILL\.md/.test(arg)) openedSkill = true;
            }
            // assistant only: the injected SKILL.md body arrives as a `user`
            // text block carrying the control needle, so counting every text
            // block lets the control pass on the injection rather than on the
            // model's answer.
            if (b.type === 'text' && msg.type === 'assistant') texts.push(b.text || '');
        }
    }
    return { openedRationale, openedSkill, invokedSkill, text: texts.join('\n') };
}

const seen = {};
for (const [cell, run] of CELLS) {
    const r = readRun(path.join(dir, 'link-' + cell + '-' + run + '.jsonl'));
    const key = cell + '/' + run;
    if (!r) { console.log(key.padEnd(12) + 'NO TRANSCRIPT'); continue; }
    const quoted = r.text.includes(SENTENCE[cell]);
    const notFound = /NEEDLE NOT FOUND/.test(r.text);
    seen[key] = { quoted, notFound, ...r };
    console.log(key.padEnd(12)
        + 'skill:' + (r.invokedSkill ? 'yes' : 'no ')
        + '  read rationale.md:' + (r.openedRationale ? 'yes' : 'no ')
        + '  read SKILL.md:' + (r.openedSkill ? 'yes' : 'no ')
        + '  quoted "' + SENTENCE[cell] + '":' + (quoted ? 'yes' : 'no ')
        + (notFound ? '  [said NEEDLE NOT FOUND]' : ''));
}

console.log('');
const control = [seen['control/1'], seen['control/2']].filter(Boolean);
const controlHit = control.length === 2 && control.some((c) => c.quoted);
if (!controlHit) {
    console.log('CONTROL FAILED — neither control run found a word that is in the SKILL.md');
    console.log('itself, so the skill did not reach the model and the linked cell proves nothing.');
    process.exit(1);
}
console.log('control held: the SKILL.md needle was found, so the skill did load.');

for (const [tag, label] of [['linked', 'haiku'], ['sonnet', 'sonnet']]) {
    const rows = [seen[tag + '/1'], seen[tag + '/2']].filter(Boolean);
    if (!rows.length) continue;
    console.log(label.padEnd(8)
        + 'opened rationale.md: ' + rows.filter((l) => l.openedRationale).length + ' of ' + rows.length
        + '   quoted its sentence: ' + rows.filter((l) => l.quoted).length + ' of ' + rows.length);
}
