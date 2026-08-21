'use strict';

// The three output styles, and the short form of each.
//
// The full styles live in `output-styles/*.md` and go into the system prompt,
// which is where a constant belongs: sent verbatim on every request, never
// touched by compaction, and one copy however long the session runs.
//
// The digests below exist for one job only — bridging the gap between "the
// setting has been written" and "the setting is in force". They are four lines
// rather than the whole file because a digest injected on every turn accumulates
// in the transcript, and paying that to enforce brevity would be self-defeating.
//
// `name` is what the user types. `file` is the style's real name, which is what
// `/config` shows and what settings.json records; the two differ so that
// `/fankeel-style terse` reads the way people talk.

const STYLES = [
    {
        name: 'terse',
        file: 'fankeel-terse',
        summary: 'Everyday work. Result first, no preamble, no tool narration.',
        digest: [
            'Lead with the result. No preamble, no restating the question, no announcing what you are about to do.',
            'Do not narrate tool calls — no plan before them, no progress note between them.',
            'Never compress a negation, a number, an identifier, a path, a flag or an error string. Code blocks are never compressed.',
            'Reply in the language the user writes in. Compress the style, not the language.',
        ],
    },
    {
        name: 'pipeline',
        file: 'fankeel-pipeline',
        summary: 'Running the pipeline. Terse, plus the question discipline.',
        digest: [
            'Lead with the result. No preamble, no tool narration.',
            'Never stop silently. End each step with AskUserQuestion, never prose, and always offer a pause.',
            'Put a question’s background inside the question. Every option states its trade-off; the recommended one comes first.',
            'Reply in the language the user writes in. Never compress identifiers, numbers or error strings.',
        ],
    },
    {
        name: 'review',
        file: 'fankeel-review',
        summary: 'Reviews and audits. Findings only, most severe first.',
        digest: [
            'Findings only, most severe first, one line each: `path:line  severity: problem. fix.`',
            'No praise, no summary of what the code does, no redesigns, no finding you cannot point a line number at.',
            'Say which findings you confirmed and which you suspect, and what you could not check.',
            'Reply in the language the user writes in. Quote the shortest decisive line, never a dumped log.',
        ],
    },
];

const NAMES = STYLES.map((s) => s.name);

const byName = (name) => STYLES.find((s) => s.name === String(name || '').toLowerCase().trim()) || null;

// Accepts either form, because settings.json records the file name and the user
// types the short one, and a status display has to recognise what it reads back.
const byAny = (value) => {
    const v = String(value || '').toLowerCase().trim();
    return STYLES.find((s) => s.name === v || s.file.toLowerCase() === v) || null;
};

module.exports = { STYLES, NAMES, byName, byAny };
