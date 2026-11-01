---
name: fankeel-ask
description: Interrupt the stage you are in and put one question to a stronger model — a one-shot judge whose answer is filed verbatim and then acted on. Use for /fankeel-ask, "問判官", "叫 fable", "這題我們解不開", or when a mid-stage question is worth a model above the one running the session.
argument-hint: "[the question, in one line]"
version: 0.146.1
status: current
last_verified: 2026-10-28
source_of_truth: scripts/judge.js
---

# fankeel-ask

Produces one judgement, filed, that the stage then acts on.

**Done when** the brief is on disk, the judge has answered once, `judge.js
record` has filed the answer verbatim, any `ask human:` question has been put
to the user and filed with `judge.js answered`, and one line has said what the
stage accepted. That list runs out. A second question to the judge in the same
stage is not more diligence — it is what the one-shot shape exists to stop.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **No fallback path.** Never the working directory, a home directory, a
  global skill root, or another copy found by name — that one path resolves,
  or none does.
- **A missing script stops this, named.** Say which path you resolved and
  that it is not in this plugin install — never a guess at where it moved,
  never a workaround.

## Nothing advertises this

No rule mentions it, on any stage, and that is deliberate: a line riding every
prompt to say a stronger model is available invites deferring to it. The user
knows this command exists; the session does not get told.

So **you do not reach for this on your own.** It runs when the user types it.

## Not a defect

| Looks like a finding | Why it is not |
|---|---|
| The judge answered and the session proceeded without asking the user | That is the shape. A judgement is input the stage acts on, not a second question the user has to sit through — the gate is still at the end of the stage. |
| The controller asked the user once after the judge answered | `ask human:` is the flow: the judge sends its questions there and the controller asks them once. A gate refusal of a paraphrased question is the check working. |
| One question, then the stage carries on with others unanswered | One-shot means one. A second question in the same stage is a second `/fankeel-ask`, typed by the user, not a follow-up message to the same judge. |
| No active task, and this refused | `<plugin>/scripts/judge.js` refuses to file against a session with no active entry; the refusal names the session and the registry root. |

## It interrupts; it does not run alongside

Not a background helper. It stops what the stage was doing, spends one judge
dispatch plus up to eight readers, and the stage resumes on the answer.

**It never opens the gate.** The gate stays at the end of the stage, asked of
the user with `AskUserQuestion`. A judgement changes what the stage produces;
it does not approve it.

## The four steps, in this order

1. **Write the brief first**, to `.fankeel/build/ask/<n>-<slug>-brief.md` —
   `<n>` counting from 1 within this task, `<slug>` lowercase ascii, digits
   and dashes. It holds the question, its options, the background, the paths
   to read, what counts as an answer, and the answer's shape.
   Add a line reading exactly `html: yes` when the answer is a comparison
   table, figures or an architecture the user should see drawn: `record`
   then writes a self-contained HTML page beside the record, any ```chartroom
   fence in the judge's summary drawn as a picture.
   `build/` is already in `.fankeel/.gitignore`, so this adds no new ignored
   name. On a controlled stage the guard refuses every other controller write
   but lets this one through (`asksBrief`, `hooks/guard.js`), so the judge is
   asked from the stage the user is in — no `task.js route` detour.
2. **Dispatch it once**, `subagent_type: fankeel:fankeel-judge`, and read the model
   from the profile's `judge.model` — **never inherited**, the same discipline
   every other dispatch in this plugin carries. `node <plugin>/scripts/task.js
   profile show` prints it. Say how many and on which model in the response
   that sends it — one judge, on whatever `judge.model` answered. The judge
   writes a checklist, sends at most eight `fankeel:fankeel-reader`
   (`dispatch.inflight`) in that same response, related lines to one reader,
   on sonnet, or opus where one figure decides the pick, and returns seven
   fields, `ask human:` last (`nothing` when it asks none), then a `## 白話`
   of at most 600 characters, then a `## Summary` of any length; `delegated:`
   says which reader read what.
3. **Record the answer verbatim:**

   ```
   node <plugin>/scripts/judge.js record --session <id> --brief <path> --transcript <session>/subagents/agent-<id>.jsonl --slug <slug> --model <m>
   ```

   Point it at the judge's transcript rather than retyping the answer —
   retyping is where a judgement quietly becomes a paraphrase of one. It writes
   the file, dated, under the project's judgements bucket (`.fankeel/docs.json`
   declares one, else `docs/judgements/`) and adds its row to the `## Judgements`
   table where the project has one.

   The frontmatter carries `judged`, `model`, `agent: fankeel-judge`, `task`,
   `session`, `stage` and `human`; the brief and the answer follow it copied in
   whole. A `--slug` already on disk gets `-2`, not an overwrite. A missing
   `--session`, `--brief` or `--slug`, or neither or both of `--answer` and
   `--transcript`, exits 1 before anything is written. `--model` is `fable` when
   left off; `--root <dir>` names the registry and `--project <dir>` the project.

   `--transcript` takes the message of the judge's `SubagentHandback` call, and
   the last assistant text only where there is none — a judge that hands back
   ends on "handing back now", which is not the answer. `tasks/<id>.output` of a
   background dispatch is 0 bytes, so it is never the source. `--answer <path|->`
   takes the text directly; `record` refuses any answer, from either flag, with
   no `pick:` line.

   After the filed line, `record` prints `plain:` and the judge's `## 白話`
   section, cut at 600 characters (`PLAIN_MAX`, `lib/judgepage.js`), or
   `plain: none — …` when the answer has none. Where the brief said `html: yes`
   it also prints `html: <path>`; `node <plugin>/scripts/judge.js html
   <judgement.md>` draws that page again for a record already filed.

   **3b. If record prints `questions:`**, open the printed `page:` in the
   browser pane, then `AskUserQuestion` once with the `questions` copied
   verbatim — the gate refuses a paraphrase. Pipe the
   `answers` map to `node <plugin>/scripts/judge.js answered --session <id>
   --record <path> --answers -` and follow its `decision:` line: the assumed
   option means `pick:`, another its `→` branch; only a free-text or
   off-branch answer earns a second `/fankeel-ask`, with `--record <path>`.

4. **Say what the stage accepted, in one line, and carry on.** Name the file
   the record landed in. At the next gate, option one's description names it
   too, so approving the stage's output also shows what it was decided on.
   Carrying on happens in this same turn: where the ask also started the task,
   the stage's own work follows the reply instead of waiting to be told.

## When it is worth the money

Not here. That judgement is the user's, and the criteria live in
[docs/subagents.md](../../docs/90-agent/reference/subagents.md), not in any file
a model reads on every prompt. If you are reading this, the decision has
already been made.

## Output

The `filed` path lands in the judgements bucket (`docs/judgements/` if none is
declared); the example is illustrative:

```
judged: <the question, one line>
model: <what judge.model said>
filed: docs/judgements/<date>-<slug>.md
html: <the page record wrote — only when the brief said html: yes>
accepted: <what the stage now does differently, one line>

<the plain: block record printed, copied as it came>
```

The reply is those lines and the `plain:` block, copied rather than retyped:
the judge's own plain words are what let the user say the pick and its main
reason without asking again. The seven fields and `## Summary` stay in the file.
