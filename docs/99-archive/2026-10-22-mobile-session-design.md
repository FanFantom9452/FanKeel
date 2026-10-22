---
status: current
role: plan
last_verified: 2026-10-22
source_of_truth: hooks/stop.js, hooks/inject.js, scripts/station.js, assets/station/mobile.js, lib/tailscale.js
---

# 手機頁接上 session — design

The phone page `/m` talks to a live Claude Code session through the Stop hook:
while the phone has attached a session, the hook holds at the end of each turn,
and a message typed on the phone comes back as `{decision:'block', reason}`, which
Claude Code runs as the next instruction. The reply the phone shows is the turn's
`last_assistant_message`. Mockup: `.fankeel/build/2026-10-22-mobile-session/mockup.html`.

Chosen at survey (`.fankeel/build/task-20261022T065333/survey.md`) over Channels
(needs a launch flag, research preview) and `--resume` (a fork, not the same
session). Notifications are out of scope, by the user's word.

## What was measured

Probed 2026-10-22 with `claude -p` and a throwaway Stop hook:

- `{decision:'block', reason}` runs `reason` as the next turn: a reason asking for
  `BANANA` got `BANANA`, and the second Stop carried `stop_hook_active: true` and
  `last_assistant_message: "BANANA"`.
- Stop's stdin carries `session_id`, `transcript_path`, `cwd`, `stop_hook_active`
  and `last_assistant_message`.
- Claude Code honours at most 8 consecutive blocks, then ends the turn regardless;
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=12` raised it to 12. A prompt typed at the
  desktop starts a new chain.

- With background work running, Stop's `background_tasks` lists each item as
  `{id, type, status, description, command}` (`type` `shell` for a background
  Bash); when the work finished and woke the session, the next Stop carried `[]`.

## What the phone shows

Every live session lands in exactly one of these, and the three the user must
never confuse — 等你答, 在跑, 停下來 — differ in colour, wording and order:

| state | means | where it comes from |
|---|---|---|
| `gate` 等你答 | a question is waiting on the user | the gate's pending file, as `mobile.json` has it |
| `holding` 手機接著 | the phone holds the session, waiting for a message | `holding.json` |
| `running` 跑中 | a turn is in progress | liveness, and no Stop since the last prompt |
| `background` 背景跑中 · N | the turn ended, background work is still running and will wake it | the last Stop's `background_tasks`, non-empty |
| `idle` 停下來 | the turn ended, nothing is running, nothing was asked | the last Stop's `background_tasks` empty, no gate |

- The home list puts 等你答 first, then 手機接著, 跑中 and 背景跑中, then 停下來, under a one-line count of each.
- A 背景跑中 row names its first one or two background items with elapsed time, and `+N` for the rest.
- The conversation screen of a 背景跑中 session lists every background item and says no reply is needed.
- Sending a message, attaching and 交還電腦 are the only actions besides answering a gate.

## Scope

Sessions with a registry entry — the ones the station already lists. A session
not in fankeel mode is not reachable from the phone.

## 1. The phone channel files

- One directory per session, `<registry>/.fankeel/station/phone/<session_id>/`, already gitignored with `station/`.
- `attach.json` `{at, device}` exists while the phone holds the session; removing it is 交還電腦.
- `inbox.json` `{text, at}` is the one message waiting; the station refuses a second one while it is there (409).
- `holding.json` `{since, until}` exists only while the Stop hook is waiting, so the phone can tell 手機接著 from 跑中.
- `chat.jsonl` is the conversation, one `{role, text, at}` a line, `role` one of `desktop`, `phone`, `assistant`; kept to its last 200 lines on each append.
- `lib/phone.js` owns every read and write of these files; nothing else opens them.

## 2. The Stop hook holds

- `hooks/stop.js` appends `last_assistant_message` to `chat.jsonl` as `assistant` on every Stop of a registry session, and writes `background_tasks` with the Stop's time to `background.json`, so an empty list clears it.
- The existing refusal (`lib/stop.js`) still runs first and still only when `stop_hook_active` is false; when it blocks, the phone path does not run that time.
- With `attach.json` present, the hook writes `holding.json` and polls `inbox.json` every 200 ms, the way `stationAnswers` in `hooks/gate.js` does, for up to `phone.hold` seconds — a new profile key, default 1800.
- A message arrives: the hook removes it, appends it as `phone`, removes `holding.json`, and prints `{decision:'block', reason:'（手機）<text>'}`.
- `attach.json` disappears, or `phone.hold` runs out: the hook removes `holding.json` and prints nothing, so the session goes idle at the desktop; on timeout it also removes `attach.json`.
- The phone path runs whether or not `stop_hook_active` is true — every phone message is a block.
- `.claude-plugin/plugin.json` raises the Stop hook's timeout from 5 to 1805.

## 3. The desktop side

- `hooks/inject.js` appends each prompt typed at the desktop to `chat.jsonl` as `desktop`, and removes `attach.json`: typing at the desktop takes the session back.
- A new user-invoked skill, `/fankeel-phone`, runs `node <plugin>/scripts/phone.js attach --session <id>` and answers one line, so an idle session can be handed to the phone: its own turn ends and the hook holds.
- The guide tells the user to set `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` in their own `settings.json` `env` to talk past 8 messages in a row; fankeel does not write it.

## 3b. Tool steps

- `hooks/budget.js`, which already runs on PreToolUse and PostToolUse for every tool, appends one `chat.jsonl` line per tool call of a registry session: `{role:'tool', id, tool, label, at}` before it runs and `{role:'tool-end', id, ok, at}` after.
- `label` is at most 80 characters: Bash and PowerShell their `description`, else the command's head; Edit, Write and Read the path relative to the session's cwd; Grep and Glob the pattern; Agent its `description`, with `background` set when `run_in_background` is; an `mcp__<server>__<tool>` call `<server> · <tool>`.
- AskUserQuestion writes no step: it is the gate card.
- Intermediate assistant text is not recorded; the turn's reply is the Stop's `last_assistant_message`.
- The phone groups a turn's steps into one line — counts of steps, files changed, agents, failures — collapsed when the turn has ended, and shows the last three open, the running one with a spinner, while it is in progress.

## 4. The station routes

- `GET /station/phone.json?id=<session>` answers `{state, chat, gate, background}` — `state` one of the five in the table above (with `attached` as a flag beside it, since a running session can be attached before its Stop); `chat` the last 50 lines; `gate` the pending gate as `mobile.json` carries it; `background` the items from `background.json`.
- `mobile.json` rows carry the same `state` and `background`, so the home list needs no second request.
- `POST /phone/attach`, `/phone/detach` and `/phone/say` (`id`, and `text` for say), under the same device policy as `/answer`: a paired cookie and `sameOrigin`.
- `/phone/say` answers 409 when the session is not attached or a message is already waiting, and 201 otherwise.
- `running` versus the stopped states comes from the same liveness the station already reads, plus whether the last `chat.jsonl` line is `assistant`; a stopped session is `background` while `background.json` lists anything, else `idle`.

## 5. The phone page

- `assets/station/mobile.js` and `mobile.css` are redrawn to the mockup's approved direction: one session list as home, and a conversation screen per session (`#/s/<id>`).
- The conversation screen polls `phone.json` every 2 s while visible; the home list keeps `mobile.json` at 5 s.
- A pending gate shows inside the conversation as a card posting to the existing `/answer`, replacing the separate bottom sheet.
- Direction A「訊息 app」of the mockup, chosen at the design gate.
- The composer and a gate's free-text answer each carry a mic button using the Web Speech API (`SpeechRecognition` or `webkitSpeechRecognition`, `lang: 'zh-TW'`, interim results shown in the field); voice fills the field and never sends by itself.
- Tapping the mic in a gate card selects its free-text option.
- Where the browser has no Speech API the mic button is not drawn, and the keyboard's own voice key is the way in.
- This takes in the TODO 手機頁自己寫答案欄加麥克風鈕, which `land` closes.

## 6. Tailscale on Windows

- `lib/tailscale.js` falls back to `%ProgramFiles%\Tailscale\tailscale.exe` when spawning `tailscale` fails with `ENOENT` on win32.

## Proves it done

- `tests/phone-stop.test.js`: with `attach.json` present and a message written to `inbox.json`, `hooks/stop.js` prints a block whose reason carries the text — fails today (the hook prints nothing on `stop_hook_active: true` and has no phone path), passes after.
- `tests/phone-state.test.js`: a session whose last Stop carried one running `background_tasks` item reads `background`, and one whose last Stop carried `[]` reads `idle` — fails today (no such state), passes after.
- `tests/station-phone.test.js`: `POST /phone/say` from a paired device writes `inbox.json` and answers 201; unpaired answers 401.
- Live: from the S24 in Samsung Internet over Tailscale, attach a running session, send two messages, see both replies, then 交還電腦 and type at the desktop.

## Not verified

- Whether PostToolUse fires for a tool call that failed, and what marks it failed; a step with no `tool-end` by the turn's Stop is shown as 失敗 until this is measured.
- Whether Samsung Internet on the S24 exposes the Speech API over the tailnet's https; if it does not, the mic button stays hidden there and the keyboard key is the fallback.
- Whether the user can type at the desktop terminal while the Stop hook is holding, or only interrupt with Esc. The live check settles it; if typing is blocked, 交還電腦 from the phone and Esc are the two ways back.
