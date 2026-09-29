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
const { prefixFor, retitle, overrideFor } = require('../lib/title.js');

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
    const bare = overrideFor(input.subagent_type, payload.cwd, configDir);
    const next = bare ? { ...input, subagent_type: bare } : input;
    const prefix = prefixFor({
        toolInput: next,
        pluginRoot: path.join(__dirname, '..'),
        projectDir: payload.cwd,
        configDir,
        transcriptPath: payload.transcript_path,
        env: process.env,
    });
    const description = prefix === null ? input.description : retitle(input.description, prefix);
    if (!bare && description === input.description) return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...next, description } },
    }));
}

if (require.main === module) run(main);
