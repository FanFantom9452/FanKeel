---
status: current
last_verified: 2026-09-05
source_of_truth: this file is the source; nothing derives it
---

# Measurements taken during the stage-division build, 2026-09-05

A dated snapshot. Four figures were quoted in
[docs/plans/2026-09-04-stage-division-design.md](../plans/2026-09-04-stage-division-design.md)
and in [skills/fankeel-build/SKILL.md](../../skills/fankeel-build/SKILL.md) with
no citation, which a whole-branch review caught. This is where they come from.

**Read the provenance column before quoting any of them.** **One** is
reproducible from the repository — the probe. The other **three** are not: they
come from Claude Code's own workflow run records under the session directory,
which is per-machine and not version controlled, so they can be checked today on
the machine that ran them and never again anywhere else. That is a real limit on
the claim, not a formality.

An earlier draft of this paragraph said two and two, which its own table below
already contradicted. A verify-stage adversary caught it.

| Figure | Where it is quoted | Provenance |
|---|---|---|
| Twenty-one probes for a skill's own procedure against its stage's injected rules returned twenty `no` | design, §3 | Reproducible. The probe is in this file below; it reads `lib/stages.js` and nothing else. |
| Seven agents and one return, for a group of three | design §3, `fankeel-build` SKILL | Workflow run `wf_b639c66b-9d4`, `agentCount: 7` — three implementers, three reviewers, one fixer. Per-machine. |
| 1,169,842 subagent tokens over two runs, about 37 minutes | design, §3 | The two runs of workflow `stage-anchors`: 753,922 tokens / 1,044,982 ms and 415,920 / 1,188,736. Per-machine. |
| Eleven alternative rewrites of one parenthetical | design, §3 | The first `stage-anchors` run returned eleven `fits` entries for `build`, each replacing the same substring of `lib/stages.js:267`. Per-machine. |

## The probe, which anyone can re-run

```
cd <repo> && node -e "
const s=require('./lib/stages.js'), r=require('./lib/render.js');
const probes={
  survey:['orient','class','task.js start'],
  design:['spec','design-intent','self-review'],
  plan:['Interfaces','Consumes','## Task'],
  build:['worktree','Commit:','five'],
  verify:['ranges','ledger','red-green|revert'],
  audit:['pair','reader','todo-check'],
  land:['suite','test','version']
};
for(const n of s.NAMES){
  const own=s.rulesFor(n,Object.assign({next:'x',ponytail:r.ponytailLine()},r.SCRIPTS)).slice(s.ALWAYS.length);
  const hay=own.join(' | ')+' | '+(s.templateFor(n)||'');
  console.log(n.padEnd(7), probes[n].map(p=>p+'='+(new RegExp(p,'i').test(hay)?'YES':'no')).join('  '));
}
"
```

Run against `fc06fa5`, the commit this branch started from, it printed:

```
survey  orient=no  class=YES  task.js start=no
design  spec=no    design-intent=no  self-review=no
plan    Interfaces=no  Consumes=no  ## Task=no
build   worktree=no    Commit:=no   five=no
verify  ranges=no      ledger=no    red-green|revert=no
audit   pair=no        reader=no    todo-check=no
land    suite=no       test=no      version=no
```

The single `YES` is the output template's bare `class:` field, which is the
finding rather than an exception to it: a template slot is the anchor that
works, because the template is re-sent every prompt and enumerates what must be
on screen.

**Re-running it on this branch will not reproduce that table**, and should not:
**six** of the seven stages gained anchors here — `plan`, `build`, `verify`,
`audit`, `land` and `survey`, every one but `design` — so several probes now
return `YES`. The table is what the branch started from.

## Three things this branch is, which no per-task range shows

Found by the verify stage's own adversaries, recorded here because none can be
fixed without rewriting history and all three are true of the branch as it
stands.

- **One intermediate commit is red.** At `a71b575`, `npm test` reports 1030 of
  1031: the `suite: <green>` line landed in `lib/stages.js`'s template while
  `skills/fankeel-land/SKILL.md`'s shown copy of that template did not gain it
  until `8b2e22b`, one commit later. The branch tip is green; a bisect landing
  on `a71b575` is not.
- **A commit message misattributes one file.** `a71b575` says "three
  rule-content assertions follow — tests/stages.test.js". Two are there; the
  third is in `tests/render.test.js`.
- **Tasks 1 to 3 were built against a plan that was not yet in git.** The plan
  and the design were committed at `47a8557`, after those three tasks landed.
  Anything grading that code against the plan is comparing it to a document
  written to describe it, which has little room to disagree. The order was
  wrong, not the work: both documents should have been committed at their own
  stage, which is what `47a8557`'s own message says.

## What no figure here supports

Nothing on this branch measured a Workflow against four Agent dispatches doing
the same work. Both were used, and the argument for preferring a Workflow where
a group's output feeds a reviewer is structural — the intermediates stay inside
the script — not empirical. `docs/reports/2026-09-03-dispatch-vs-inline.md` and
its two companions measured dispatch against inline, which is a different pair.
