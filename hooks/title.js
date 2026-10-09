#!/usr/bin/env node
'use strict';

// PreToolUse on `Agent|Task`: opens the description with the model, its
// version and its effort, computed by lib/title.js. Measured 2026-09-29 on
// Claude Code 2.1.284: `updatedInput` with no `permissionDecision` is applied
// — the task list, the tool result and `agent-*.meta.json` carry the rewrite,
// the model's own tool_use keeps its original — so this never allows or
// denies; hooks/guard.js on the same matcher still can. Where a generated
// agent override file exists, it also swaps `subagent_type` from
// `fankeel:<name>` to `<name>` (station-6).

const os = require('node:os');
const path = require('node:path');
const { run, parse } = require('../lib/hook.js');
const { prefixFor, retitle, overrideFor, overrideModel } = require('../lib/title.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (payload.tool_name !== 'Agent' && payload.tool_name !== 'Task') return;
    const input = payload.tool_input;
    if (!input || typeof input.description !== 'string') return;
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    // station-6: a generated override answers only the bare name, so the
    // dispatch is sent under it and titled from it. Measured before this was
    // written: docs/90-agent/todo/station-6.md, `Verdict: honoured`.
    const { bare, late } = unlessLate(overrideFor(input.subagent_type, payload.cwd, configDir), payload, configDir);
    const next = bare ? { ...input, subagent_type: bare } : { ...input };
    // An explicit `model` on the dispatch beats the agent file's, so an
    // override that pins a model of its own replaces it (fix-bug bench run,
    // 2026-10-08: `agent.fankeel-mutator.model=haiku` ran on sonnet).
    // A dispatch already under the bare name (the brain read it from the
    // generated file's name) is held to the same override.
    const type = String(input.subagent_type || '');
    const generated = bare || (type && !type.includes(':') ? overrideFor('fankeel:' + type, payload.cwd, configDir) : null);
    const pinned = generated ? overrideModel(generated, path.join(__dirname, '..'), payload.cwd, configDir) : null;
    if (pinned && typeof input.model === 'string' && input.model !== pinned) next.model = pinned;
    const prefix = prefixFor({
        toolInput: next,
        pluginRoot: path.join(__dirname, '..'),
        projectDir: payload.cwd,
        configDir,
        transcriptPath: payload.transcript_path,
        env: process.env,
    });
    const description = prefix === null ? input.description : retitle(input.description, prefix);
    const notice = late ? 'fankeel: ' + late + ' was written after this session started, and Claude Code reads agent files only when it starts — sent as ' + input.subagent_type + '. Open a new terminal for the override to take effect.' : null;
    if (!bare && !notice && description === input.description && next.model === input.model) return;
    process.stdout.write(JSON.stringify(Object.assign(notice ? { systemMessage: notice } : {}, {
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...next, description } },
    })));
}

// title-4: Claude Code reads agent files when its process starts, so an
// override written after this session's process started is not a name it
// can send to yet. The start is `startedAt` from `runningSessions` in
// lib/live.js; the file is found where lib/title.js agentFileOf looks. The
// requires sit here so the lines docs cite in main() keep their numbers.
function unlessLate(bare, payload, configDir) {
    if (!bare) return { bare: null, late: null };
    const fs = require('node:fs');
    const { runningSessions } = require('../lib/live.js');
    const file = [payload.cwd && path.join(payload.cwd, '.claude', 'agents', bare + '.md'), path.join(configDir, 'agents', bare + '.md')]
        .find((f) => f && fs.existsSync(f));
    const me = (runningSessions(configDir) || []).find((s) => s.sessionId === payload.session_id);
    if (!file || !me || !Number.isFinite(me.startedAt)) return { bare, late: null };
    let mtime;
    try { mtime = fs.statSync(file).mtimeMs; } catch (e) { return { bare, late: null }; }
    return mtime > me.startedAt ? { bare: null, late: file } : { bare, late: null };
}

if (require.main === module) run(main);
