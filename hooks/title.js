#!/usr/bin/env node
'use strict';

// PreToolUse on `Agent|Task`: opens the description with the model, its
// version and its effort, computed by lib/title.js. Measured 2026-09-29 on
// Claude Code 2.1.284: `updatedInput` with no `permissionDecision` is applied
// — the task list, the tool result and `agent-*.meta.json` carry the rewrite,
// the model's own tool_use keeps its original — so this never allows or
// denies; hooks/guard.js on the same matcher still can.

const os = require('node:os');
const path = require('node:path');
const { run, parse } = require('../lib/hook.js');
const { prefixFor, retitle } = require('../lib/title.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (payload.tool_name !== 'Agent' && payload.tool_name !== 'Task') return;
    const input = payload.tool_input;
    if (!input || typeof input.description !== 'string') return;
    const prefix = prefixFor({
        toolInput: input,
        pluginRoot: path.join(__dirname, '..'),
        projectDir: payload.cwd,
        configDir: process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
        transcriptPath: payload.transcript_path,
        env: process.env,
    });
    const description = retitle(input.description, prefix);
    if (description === input.description) return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, description } },
    }));
}

if (require.main === module) run(main);
module.exports = { main };
