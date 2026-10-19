---
status: design-intent
---

# 任務完成紀錄 — design

Every task that reaches land leaves one six-field completion record, whether or
not it closed a TODO entry. The station card and the session's last message
both show that record; nothing writes a second version of it.

Why: [reports/2026-10-19-legibility.md](../reports/2026-10-19-legibility.md)
read four landed tasks and found no single place answering "what was asked,
what changed, why, what was checked, what it cost, what is left". The pieces
existed, spread over gates, commit bodies, TODO files and the station. Two of
the four tasks closed no TODO entry, so they left no completion record at all.

Decisions taken at this stage, in the user's words where they chose:

- Where it lives: 任務紀錄加每月檔 — the registry entry carries it for the
  station, and the same text is appended to a monthly file in git.
- TODO entries: TODO 只寫一句加連結 — a closed entry's `## 完成紀錄` is one or
  two sentences on that entry, then the link to the task record.

## 1. The record

- Six fields, in this order and with these names: 要求、做了什麼、為什麼這樣做、驗過・沒驗過、花費、還剩什麼.
- 做了什麼 is a list, one line per thing someone can now do that they could not; the other five are one to three sentences.
- Written to plain-language.md: no sha, no TODO id, no `path:line`, no bare code name. `lib/plain.js`'s existing checks are the gate on it.
- 花費 is filled by the script from the station's own figures for the session (money, wall time, agent count, models), not typed by the model.

## 2. Writing it — `scripts/record.js`

- `node scripts/record.js write --session <id>` reads the record on stdin and refuses (exit 1, nothing written) when a field is missing or empty, or when `lib/plain.js` finds a bare code or an over-long sentence.
- On success it writes the record onto the registry entry (`record: { at, fields }`) and appends it to `docs/90-agent/records/<YYYY-MM>.md` under `## <YYYY-MM-DD> <task title>`, then prints the file and the heading's anchor.
- A second write for the same session replaces the registry copy and appends a new dated section marked 更正; the earlier section stays, like a judgement.
- `docs/90-agent/records/` is a new bucket in `.fankeel/docs.json`, `role: report`, `audience: human`, and a row in README's tree.

## 3. Land uses it

- Land's output template becomes the six fields plus the `suite:` line; `shipped`/`cost`/`open`/`白話` are folded in (shipped → 做了什麼, cost → 花費, open → 還剩什麼, 白話 → 要求 plus 為什麼這樣做). No rule line is added: the land block is at its cap, so the `Output:` rule is rewritten in place.
- Land runs `record.js write` before its gate. The gate's option one description names the monthly file's anchor.
- After the user answers 收工, the session's last message is the record as written, and nothing else is appended after it.
- `lib/gatereport.js` reads the six land keys, so the station's 關卡 tab shows the record while land waits.
- A TODO entry closed at land gets `todo.js done ... --record "<one or two sentences>. 詳見 <monthly file>#<anchor>"`.

## 4. The station shows it

- The session detail opens with a 完成紀錄 block holding the six fields, and under it the monthly file it is also in (mockup block `record`).
- The session's full page (`#/s/<id>`) opens with the same block above its cost strip (mockup block `record-page`).
- A session with no record shows one muted line saying so, never an empty block.
- Each landed row in the session list carries the record's 要求 as a muted second line under the title (mockup block `list-ask`), which is what tells 45 sessions called 「TODO 全表盤點」 apart.

## Pages this makes false

`docs/90-agent/reference/plain-language.md` §完成紀錄 (:31-33) says only tasks with a TODO entry write a record, under that entry; `skills/fankeel-land/SKILL.md` step 2 and its Output section give the old five lines; `docs/90-agent/reference/station.md` has no record block. Build rewrites all three. The map lists no binding decision this contradicts.

## Proves it done

- `tests/record.test.js`: a record missing 為什麼這樣做 exits 1 and writes nothing; one with a sha in 做了什麼 exits 1; a complete one writes the registry field and appends one section to the monthly file — fails today because the script does not exist.
- Land's template test: the rendered land block names the six fields and stays under the 2400 cap.
- The artefact: for one session, the station's rendered 完成紀錄 block and the monthly file's section are compared field by field — the same six strings, and the station's 花費 figure equals the station's own cost cell for that session.

## Not verified

- That `lib/station.js` can produce one session's money and time cheaply enough to call from `record.js` at land; if it cannot, 花費 falls back to the land stage's own cost line.
