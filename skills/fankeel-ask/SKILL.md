---
name: fankeel-ask
description: Interrupt the stage you are in and put one question to a stronger model — a one-shot judge whose answer is filed verbatim and then acted on. Use for /fankeel-ask, "問判官", "叫 fable", "這題我們解不開", or when a mid-stage question is worth a model above the one running the session.
argument-hint: "[the question, in one line]"
version: 0.59.0
status: current
last_verified: 2026-09-10
source_of_truth: scripts/judge.js
---

# fankeel-ask

Produces one judgement, filed, that the stage then acts on.

**Done when** the brief is on disk, the judge has answered once, `judge.js
record` has filed the answer verbatim, and one line has said what the stage
accepted. That list runs out. Asking the judge a second question in the same
stage is not more diligence — it is the thing the one-shot shape exists to stop.

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

No rule mentions it. Not on any stage, not in `ALWAYS`, not conditionally.
That is deliberate and it is the whole point: a line riding every prompt to
say a stronger model is available is an invitation to defer to it, and the
model running the session is not weak enough to need the crutch. The user knows
this command exists; the session does not get told.

So **you do not reach for this on your own.** It runs when the user types it.

## Not a defect

| Looks like a finding | Why it is not |
|---|---|
| The judge answered and the session proceeded without asking the user | That is the shape. A judgement is input the stage acts on, not a second question the user has to sit through — the gate is still at the end of the stage. |
| One question, then the stage carries on with others unanswered | One-shot means one. A second question in the same stage is a second `/fankeel-ask`, typed by the user, not a follow-up message to the same judge. |
| No active task, and this refused | `scripts/judge.js` refuses to file against a session with no active entry. There is nothing to file a judgement *for*, and the refusal names the session and the registry root. |

## It interrupts; it does not run alongside

This is not a background helper and it is not a second opinion fetched while
work continues. It stops what the stage was doing, spends one dispatch, and
the stage resumes on the answer.

**It never opens the gate.** The gate stays where it always was: at the end of
the stage, asked of the user with `AskUserQuestion`. A judgement changes what
the stage produces; it does not approve it.

## The four steps, in this order

1. **Write the brief first**, to `.fankeel/build/ask/<n>-<slug>-brief.md` —
   `<n>` counting from 1 within this task, `<slug>` lowercase ascii, digits
   and dashes. It holds the question, its options, the background that would
   otherwise sit in the dispatch stem, the paths the judge needs to read,
   what counts as an answer, and the shape the answer should come back in.
   `build/` is already in `.fankeel/.gitignore`, so this adds no new ignored
   name.
2. **Dispatch it once**, `subagent_type: fankeel-judge`, and read the model
   from the profile's `judge.model` — **never inherited**, the same discipline
   every other dispatch in this plugin carries. `node <plugin>/scripts/task.js
   profile show` prints it. Say how many and on which model in the response
   that sends it — one, always, and whatever `judge.model` answered.
3. **Record the answer verbatim:**

   ```
   node <plugin>/scripts/judge.js record --session <id> --brief <path> --answer - --slug <slug> --model <m>
   ```

   Pipe the answer in on stdin rather than retyping it — retyping is where a
   judgement quietly becomes a paraphrase of one. This is what writes it,
   dated, under `docs/judgements/`, and adds its row to the index where the
   project has a `## Judgements` table.
4. **Say what the stage accepted, in one line, and carry on.** Name the file
   the record landed in. At the next gate, option one's description names it
   too, so approving the stage's output also shows what it was decided on.

## When it is worth the money

Not here. That judgement is the user's, and the criteria are written for them
in `README.md` rather than in any file a model reads on every prompt — which
is the same reason no rule announces this command. If you are reading this,
the decision has already been made.

## Output

```
judged: <the question, one line>
model: <what judge.model said>
filed: docs/judgements/<date>-<slug>.md
accepted: <what the stage now does differently, one line>
```

Four lines. The judgement itself is in the file; repeating it here spends the
context the one-shot shape was protecting.
