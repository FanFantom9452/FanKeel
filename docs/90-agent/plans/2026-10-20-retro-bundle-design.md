---
status: design-intent
last_verified: 2026-10-20
source_of_truth: scripts/record.js, lib/bundle.js, agents/fankeel-retro.md
---

# Retro on a full, masked session bundle

Approved at the design gate on 2026-10-20, from two judgements:
[retro-full-record](../judgements/2026-10-20-retro-full-record.md) (the retro's
return is filed under the task's record) and
[retro-land-vs-skill](../judgements/2026-10-20-retro-land-vs-skill.md) (pick A:
land reviews this session, a skill reviews every bundle). The user overruled the
first judgement's "transcript never committed": a retro without the raw record
is one agent's word, so the whole session has to be restorable.

## 1. The bundle

- `node scripts/record.js session --session <id>` packs the main transcript and every `subagents/*.jsonl` of this session, and of every session this task was adopted from, into one gzip file. No model writes it.
- Every string in every line is masked before it is written: a word from `.fankeel/sensitive.txt`, or a key, token or private-key shape, becomes `[REDACTED:<kind>]`, and the JSON stays valid.
- A `.fankeel/sensitive.txt` that exists and cannot be read stops the export with nothing written.
- The bundle goes to `.fankeel/bundles/<day>-<id8>.jsonl.gz`, git-ignored. `--commit` writes it to `<records bucket>/sessions/` instead when it is 2 MB or less; over that it stays local and says so.
- The task's record entry gets one line, `- 對話紀錄：<path>（<size>，committed|local）`, and the registry entry `record.bundle`.

## 2. Reading a bundle

- `scripts/conversation.js --bundle <file>` reads a bundle in place of `--session`; `--part <rel>` picks one transcript in it, the first main transcript by default; `--list` prints the parts.
- `--tools` keeps tool calls and tool results as turns of their own, for a session or a bundle.
- `adopt` records the source session in `sessions` on the new entry, so a later export can name every session the task passed through.

## 3. Filing a retro

- `node scripts/record.js retro --session <id> --transcript <agent jsonl>` takes the retro's hand-back verbatim, the disposition from stdin, and files both under the task's record anchor in a `<details>` block.
- A hand-back whose first line is not `retro: ` is refused, and so is a session with no record yet.
- `record.js retro --cross` files a cross-bundle report as its own section of the month file.
- `record.js sessions --list` prints every bundle, local and committed, and whether a retro of it is already filed.

## 4. Land

- Land's gate always asks whether to export this session; the retro is offered only after an export, and reads the bundle.
- The retro runs on opus; `task.js profile set agent.fankeel-retro.model` still overrides it.

## 5. The skill

- `/fankeel-retro-all` lists bundles, reads every retro already filed, dispatches one `fankeel-retro` per bundle without one (at most `dispatch.inflight` per response), and ranks problems itself.
- A problem is recurring when two or more bundles carry evidence for it; only a recurring problem gets a hunk, at most five, and those may touch `lib/stages.js` and `agents/`.
- Its report is filed with `record.js retro --cross`.

## What lives where

| file | change | dispatch |
|---|---|---|
| `lib/sensitive.js` | `redact()` and `SHAPES` | implementer, sonnet |
| `lib/bundle.js` | new: `filesOf`, `pack`, `unpack` | implementer, sonnet |
| `scripts/record.js` | `session`, `retro`, `retro --cross`, `sessions --list` | implementer, opus |
| `scripts/judge.js` | export `answerFromTranscript` | implementer, opus |
| `lib/conversation.js` | `turnsOf(entries, { tools })`, tool turns in `markdownOf` | implementer, sonnet |
| `scripts/conversation.js` | `--bundle`, `--part`, `--list`, `--tools` | implementer, sonnet |
| `scripts/task.js` | `adopt` writes `sessions` | implementer, sonnet |
| `agents/fankeel-retro.md` | opus, `bundle <path>` | in-session |
| `skills/fankeel-land/SKILL.md` | the forced export question, then the retro | in-session |
| `lib/stages.js` | one land rule | in-session |
| `skills/fankeel-retro-all/SKILL.md` | new skill | implementer, opus |

## What proves it done

| check | fails now because |
|---|---|
| a session holding a fake `sk-ant-` key exported, then gunzipped: the key is absent and `[REDACTED:key]` is present | `record.js session` does not exist |
| `conversation.js --bundle <f> --tools --format jsonl` gives as many tool turns as the source has `tool_use` blocks | `--bundle` does not exist |
| a retro hand-back filed with `record.js retro` sits between its anchor and the next entry's anchor | `record.js retro` does not exist |
