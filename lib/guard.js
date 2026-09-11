'use strict';

// The hard half of collision handling. The injected warning tells you another
// session is in this file; this refuses the edit.
//
// It exists because the argument that killed the survey stage's discipline text
// applies here too: an instruction to check before editing is agreed with and
// then skipped, which is precisely how two terminals end up overwriting each
// other. A warning that only ever warns is that instruction wearing a hook.
//
// It asks by default since 2026-08-30, and refuses only when asked to. A claim
// is recorded after the edit that earned it, so the first edit into a file is
// never claimed at the moment a neighbour looks — which is a reason the guard
// misses collisions, not a reason to miss all of them. What it does buy is the
// distance between the two modes: an `ask` nobody chose costs a keypress, so it
// can be the default, and a `deny` nobody chose would cost the work, so it
// cannot. Opt *out* per task, per session, with the same one field.

const path = require('node:path');

const { entriesOverlap } = require('./overlap.js');
const { claimsOf } = require('./registry.js');
const { isLive } = require('./live.js');

// Resolved from this file rather than left to the reader, for the reason
// `lib/render.js` gives about its own scripts: a command printed into a session
// has to run exactly as printed, from whatever directory that session is in.
const TASK_SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');

// `ask` puts the collision in front of the user at the moment of the edit and
// lets them decide; `deny` refuses outright; `off` and a bare `false` are the
// two ways to say neither. Anything else, the field missing included, asks.
//
// It defaulted to off until 2026-08-30, and the reason on the record was that a
// block is only as good as the `scope` field somebody declared. Nothing declares
// a scope any more — `hooks/touch.js` and `lib/dirty.js` observe the paths
// instead — so that reason went out with the field it named.
//
// What was left was the fear of locking somebody out of their own repository,
// and that is an argument about `deny` rather than about `ask`. An `ask` nobody
// chose costs one keypress, and the text under it names the holding task and
// prints the command that puts the claim down. The gaps in `lib/dirty.js` are
// not an argument either way: every one of them makes the guard *miss* a
// collision, and missing one is exactly what the old default did on purpose.
//
// Which way an unrecognised word falls is the whole decision in miniature.
// Somebody who wrote one this does not know did not ask to be unguarded, so it
// lands on the reading they can undo.
function guardMode(data) {
    const raw = data && data.guard;
    if (raw === false || raw === 'off') return null;
    if (raw === 'deny') return 'deny';
    return 'ask';
}

// Repository-relative, forward slashes, or null for anything outside the project
// root. A file elsewhere on the machine is not this registry's business, and no
// claim could have named it anyway.
function relPath(root, file) {
    if (typeof root !== 'string' || typeof file !== 'string' || !root || !file) return null;
    let rel;
    try {
        rel = path.relative(root, path.resolve(root, file));
    } catch (e) {
        return null;
    }
    if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
}

const covers = (claims, rel) =>
    Array.isArray(claims) && claims.some((c) => entriesOverlap(c, rel));

// Edit and Write carry `file_path`; NotebookEdit carries `notebook_path`. A tool
// with neither is not a write this can reason about.
function targetOf(payload) {
    const input = (payload && payload.tool_input) || {};
    for (const key of ['file_path', 'notebook_path']) {
        if (typeof input[key] === 'string' && input[key]) return input[key];
    }
    return null;
}

const startedAt = (data) => {
    const t = Date.parse((data && data.started) || '');
    return Number.isNaN(t) ? null : t;
};

// Whose claim on this file is older. Only asked when both sides hold the file,
// and it is what stops two sessions that both touched it from blocking each
// other into a stalemate: the first claim holds, the second yields.
//
// A claim with no readable start time cannot win one of these. Mine having none
// loses by the same rule, so the tie-break never depends on which side is asking.
function claimedFirst(theirs, mine) {
    const t = startedAt(theirs);
    if (t === null) return false;
    const m = startedAt(mine);
    if (m === null) return true;
    return t < m;
}

// The live sessions that hold this file against me, newest claim last.
//
// Dead sessions are deliberately not among them, and `liveState` is what says
// which those are: a process that exited holds nothing, and a terminal killed
// yesterday would otherwise hold a file shut until somebody found the JSON and
// edited it by hand. Liveness that could not be measured answers true for
// everyone, and that direction was chosen while the default was a warning. It
// survives the default becoming `ask` because an unmeasurable registry now
// costs a prompt that names its holder and passes on one keypress. `deny` is
// where it would cost something real, and `deny` is the one nobody gets by
// default.
//
// Left that way on 2026-08-31, after asking whether `deny` should flip it. It
// should not. `deny` is opt-in, and `reasonFor` ends every refusal it produces
// with the `guard off` command, so a lockout from a registry this cannot read
// describes itself and is one command from over. Flipping it would turn the one
// mode somebody chose because a missed collision is unacceptable into the one
// mode that misses every collision the moment a directory stops being readable.
// The current direction is pinned by the test named `when liveness cannot be
// measured, every active claim blocks` in tests/guard.test.js.
function blockers(mine, others, rel, liveState) {
    if (!rel) return [];
    const mineHolds = covers(claimsOf(mine), rel);
    const out = [];
    for (const other of Array.isArray(others) ? others : []) {
        const data = other && other.data;
        if (!covers(claimsOf(data), rel)) continue;
        if (!isLive(liveState, other.sessionId, data && data.configDir)) continue;
        if (mineHolds && !claimedFirst(data, mine)) continue;
        out.push(other);
    }
    return out;
}

// Everything `blockers` hands back is live by measurement — its process is still
// running. `clear` does not measure that; it gates on how long ago the entry was
// last seen — the `isStale` check in `cmdClear` — and the two no longer answer
// together. So the command carries `--force`, which is the one form that works
// whichever of them the holder happens to be.
//
// `adopt` is not offered as a way out. A guarded session owns an active task by
// definition, and that is exactly the caller `cmdAdopt` refuses.
function reasonFor(rel, holders, sessionId) {
    const lines = [
        'fankeel: ' + rel + ' is claimed by ' +
        (holders.length === 1 ? 'another live session' : holders.length + ' other live sessions') + '.',
        '',
    ];
    for (const h of holders) {
        const data = (h && h.data) || {};
        const task = (typeof data.task === 'string' && data.task.trim()) || 'untitled';
        const stage = (typeof data.stage === 'string' && data.stage.trim()) || '?';
        lines.push('  - ' + task + ' @ ' + stage);
        lines.push('    node ' + TASK_SCRIPT + ' clear ' + h.sessionId + ' --force --session ' + sessionId);
    }
    lines.push('');
    lines.push('Wait for that task, or ask that session to move off the file. The command');
    lines.push('under it puts the claim down without taking the task over, for the case');
    lines.push('where you can see the terminal is gone and the registry cannot.');
    lines.push('');
    lines.push('`--force` is printed rather than left to you: what blocks here is a running');
    lines.push('process, but `clear` asks how long ago the entry was last seen. A holder that');
    lines.push('spoke recently is refused without it, and one that has been quiet all day is');
    lines.push('not — live either way. Forcing deletes nothing, and the entry stays');
    lines.push('adoptable, though not by this session, which owns an active task of its own');
    lines.push('and would be refused.');
    lines.push('');
    lines.push('To go back to warnings only:');
    lines.push('  node ' + TASK_SCRIPT + ' guard off --session ' + sessionId);
    return lines.join('\n');
}

// null means say nothing, which is what every path that is not a live collision
// returns. A PreToolUse hook that answers "allow" on every unrelated edit is a
// hook that overrides the user's own permission rules for tools it knows nothing
// about.
function decide({ mine, sessionId, others, root, file, liveState }) {
    const mode = guardMode(mine);
    if (!mode) return null;
    const rel = relPath(root, file);
    if (!rel) return null;
    const holders = blockers(mine, others, rel, liveState);
    if (!holders.length) return null;
    return { decision: mode, reason: reasonFor(rel, holders, sessionId) };
}

// `Bash|PowerShell` matcher 用的身分表。這三個型別的工具清單本來就拿掉了
// Edit/Write，但一句 shell redirect 不走那兩個工具——`files_ref.txt` 就是這樣
// 留下來的：一個交代「什麼都不寫」的 fankeel-reader，在 09-11 的 survey
// workflow 裡用 `>` 寫了它。`fankeel-verifier` 不在這張表裡，寫自己的證據檔
// 是它的工作。
const READ_ONLY_AGENTS = new Set(['fankeel-reader', 'fankeel-reviewer', 'fankeel-judge']);

// `agent_type` 到底是裸名還是帶 `fankeel:` 前綴，
// docs/reports/2026-09-11-hook-payload-probe.md 量過，這裡兩種都收。
function readOnlyAgentType(agentType) {
    const bare = String(agentType || '').replace(/^fankeel:/, '');
    return READ_ONLY_AGENTS.has(bare);
}

// 拒絕清單而不是允許清單——一張允許清單會連 `npm test`、`node scripts/...`
// 這些 reader 本來就該跑的指令一起擋下。只對這三個型別的 Bash/PowerShell
// 呼叫跑，不是對全機每一個 session，這正是
// docs/judgements/2026-09-10-shell-whitelist.md 否決的那個提案（對每個
// session 的每一句 Bash 都跑）與這次的差異：成本只落在三個型別身上。
const WRITE_PATTERNS = [
    />>?\s*(?!\/dev\/null\b|\$null\b)\S/, // 除了 /dev/null、$null 以外的 redirect
    /\btee\b/,
    /\b(?:rm|mv|cp)\b/,
    /\bsed\b[^\n]*(?:-i\b|--in-place\b)/,
    /\bgit\s+(?:add|commit|checkout|switch|restore|reset|stash|clean|apply|am|merge|rebase|cherry-pick|revert|pull)\b/,
    /\b(?:Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item)\b/i,
];

function writesFiles(command) {
    if (typeof command !== 'string' || !command.trim()) return false;
    return WRITE_PATTERNS.some((re) => re.test(command));
}

module.exports = { guardMode, relPath, covers, targetOf, claimedFirst, blockers, reasonFor, readOnlyAgentType, writesFiles, decide };
