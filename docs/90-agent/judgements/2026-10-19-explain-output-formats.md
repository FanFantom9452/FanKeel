---
judged: 2026-10-19T11:06:22.540Z
model: fable
agent: fankeel-judge
task: "ASD-STE100/圖/HTML/影片 對 skill 輸出與 fankeel-explain 的用處（/fankeel-ask）"
session: 8e505921-0314-4eac-98c7-45ca3e1370dc
stage: survey
---

# Brief: does Karpathy's "output-format ladder" change anything in fankeel's skill outputs, and in fankeel-explain?

## Question

# Brief: does Karpathy's "output-format ladder" change anything in fankeel's skill outputs, and in fankeel-explain?

## Question

The user pasted a post (Andrej Karpathy, 2026) arguing that as LLMs do more of the work,
humans move to oversight and understanding, and that the output format matters. His ladder,
each rung "even better" than the last:

1. **Writing in ASD-STE100** (Simplified Technical English, aerospace controlled language) —
   or "80% of the way to ASD-STE100" because the full spec is stringent.
2. **Diagrams / images** instead of prose.
3. **HTML** — an interactive web page.
4. **Bespoke explainer videos** (3b1b style, TTS narration, local or ElevenLabs).

Closing claim: because code is now cheap, ask for large, custom, *discardable* artifacts
(web apps, video explainers) that never made sense to build before.

The user asks (in 繁體中文): is this useful for our skills' outputs? And we have an explain
skill in fankeel (`skills/fankeel-explain`) — analyse first, then discuss with me.

Decide: **which rungs, if any, fankeel should adopt, where, and in what shape** — and which it
should explicitly not adopt.

## Options

- **A. Nothing.** fankeel's existing prose discipline (fankeel-explain, `prose.style`,
  plain-language reference) already covers what matters; the ladder is aimed at a human
  reading a chat, not at a plugin's stage reports.
- **B. Writing rung only.** Add an STE-like option: e.g. a `prose.style` value (`ste`) or fold
  STE rules (one topic per sentence, ≤20 words procedural / ≤25 descriptive, active voice,
  approved-vocabulary-ish, one meaning per word) into fankeel-explain / plain-language.
- **C. Writing + diagrams.** B, plus fankeel-explain (or reports) may produce a diagram
  (mermaid / SVG) where a structure, flow or comparison is the point.
- **D. Up to HTML.** C, plus a discardable HTML explainer as an output of fankeel-explain
  (e.g. "explain this task / this report as a page"), reusing what fankeel already has for
  HTML (the station, the design-stage mockup agent, `lib/render.js` / render reviewer).
- **E. Full ladder.** D, plus a video rung, likely by routing to the existing `launch-video`
  plugin skill rather than building one.
- Any mix the evidence supports (e.g. B for stage reports, D only on explicit request).

## Background

- fankeel is a Claude Code plugin: a task registry plus stages (survey, design, plan, build,
  verify, audit, land), each with a skill, stage agents that write reports and gates, and a
  monitoring "station" (HTML). Reply language is 繁體中文 for this user.
- The user's interest is human *understanding* of what the sessions and agents produced:
  reports, gates, status syncs, judgements.
- Cost and context matter in this project: several standing rules exist precisely to keep
  every-turn prompts small (see how fankeel-ask itself is deliberately unadvertised). Any
  adoption that adds lines to per-turn injected rules has a cost to weigh.
- `prose.style` already exists with values writer / plain / sepia / custom (.fankeel/prose.md).

## Paths to read

- `skills/fankeel-explain/SKILL.md` — the explain skill (96 lines). What it already demands.
- `docs/90-agent/reference/plain-language.md` — existing plain-language rules; compare to STE.
- `lib/prose.js`, `docs/01-guide/profile.md` (prose.style), `docs/90-agent/reports/2026-10-05-prose-styles.md`
  — how styles are defined and where they are injected (stage agents, writer). Is adding a style cheap?
- `hooks/brief.js` — what is injected every turn; cost of any new rule.
- `docs/90-agent/reference/sources.md` — whether STE / similar has been considered before.
- HTML capability already present: the station (`skills/fankeel-station`, its scripts),
  `agents/` mockup agent definition, `lib/render.js`, render reviewer. Can an explain-as-HTML
  reuse them, or would it be new machinery?
- Stage report / gate shapes: one or two of `skills/fankeel-survey/SKILL.md`,
  `skills/fankeel-verify/SKILL.md` — what a human actually reads at a gate (AskUserQuestion,
  terminal / desktop app), and whether a diagram or HTML would render there.
- `docs/90-agent/todo/` — any existing entry on diagrams, HTML reports, or explain outputs.
- The `launch-video` skill is installed as a separate plugin (not in this repo); treat it as
  available for routing, not for editing.

## What counts as an answer

A pick among A–E (or a stated mix), justified by what the files show: what fankeel-explain
already covers vs. what STE adds; where a diagram/HTML would actually be seen by the user
(chat, gate, station, a file opened in the app pane); what each rung would cost in
per-turn context and maintenance; and the concrete first change, if any (which file, what
line or section, roughly how big). Also name what should be explicitly rejected and why.

## Shape of the answer

The six fields, then `## Summary` of any length. In the summary, include a short table:
rung → adopt / reject / on-request-only → where in fankeel → cost. Written so the session can
discuss it with the user in 繁體中文 (the answer itself may be in English).

## Answer

pick: A — nothing new to build. The same Karpathy ladder was adopted on 2026-10-05 (TODO explain-1, done, sha ba05309c) in the shape the files already show; rungs 2 and 4 are parked in TODOs with triggers the user set. The one lever left unpulled is `prose.style`, unset in this project (zero-code, one command). HTML stays on-request via the mockup agent's existing serve/check path; no `ste` style, no diagram rule, no video build.
why: docs/90-agent/todo/explain-1.md:14-19 records this exact passage, discussed 2026-10-05: rung 1 became plain-language.md's five rules (:15-19, source ASD-STE100 at :11) plus machine checks; rung 4 went to explain-2 (watch); rung 2 is docs-1 (blocked, the user chose to build diagram generation in another project first).
why: skills/fankeel-explain/SKILL.md:92-96 already binds to plain-language.md, and lib/prose.js:19 `plain` already says "active voice, one fixed word for one thing, after ASD-STE100" — an `ste` style would duplicate it at 4 code sites + 2 tests and ~450 chars in every non-build stage brief.
why: no surface a human reads at a gate renders a diagram or HTML: AskUserQuestion with a fixed bullet template under 120 words (skills/fankeel-survey/SKILL.md:397-413); the station gate tab parses reports by template and has no arbitrary-page route (scripts/station.js:462,536).
why: the per-turn block sits at 2397 of its 2400 cap (docs/90-agent/reference/registry.md:241-242; lib/render.js:281), so any standing rule line is impossible without cutting another.
why: .fankeel/profile.json has no `prose.style`, so stage agents and the writer run `writer` today; `task.js profile set prose.style plain` is the only zero-code way to turn the STE-like style on, and the user should decide it knowing plain took 24 sentences where writer took 8 (reports/2026-10-05-prose-styles.md:20-25).
would flip if: Claude Code's chat or desktop pane rendered mermaid/HTML inline (then C costs nothing in fankeel-explain), or the user says the 2026-10-05 decision in explain-1 no longer stands.
unread: nothing the brief named went unopened; `.fankeel/prose.md` does not exist (no custom style in use); the launch-video plugin is outside the repo, treated as routable only, as the brief said.
delegated: skills/fankeel-explain/SKILL.md (opus); docs/90-agent/reference/plain-language.md (opus); lib/prose.js + docs/01-guide/profile.md + docs/90-agent/reports/2026-10-05-prose-styles.md + lib/profile.js + tests/prose*.test.js (sonnet); hooks/brief.js + lib/render.js caps + .claude-plugin/plugin.json + hooks/inject.js (sonnet); docs/90-agent/reference/sources.md + repo grep for STE/Karpathy + docs/90-agent/judgements listing (sonnet); skills/fankeel-station/SKILL.md + scripts/station.js + lib/serve.js + agents/fankeel-mockup.md + scripts/render.js + agents/fankeel-render-reviewer.md (sonnet); skills/fankeel-survey/SKILL.md + skills/fankeel-verify/SKILL.md + repo grep for mermaid/diagram/svg (sonnet); docs/90-agent/todo/ + .fankeel/map.md + docs/90-agent/plans/ + skills/fankeel-ask/SKILL.md (sonnet).
checklist: 1 fankeel-explain demands — answered. 2 plain-language vs STE — answered. 3 prose styles: definition, injection, cost — answered. 4 every-turn injection cost — answered (note: hooks/brief.js is SubagentStart; the per-turn block is hooks/inject.js → lib/render.js). 5 STE considered before — answered (yes, explain-1). 6 HTML machinery reuse — answered. 7 what a human reads at a gate — answered. 8 TODO/map entries on diagrams/HTML/explain — answered. unread: launch-video (outside repo).

## Summary

### The decisive fact: this question was already answered on 2026-10-05

`F:/ymlab/fankeel/docs/90-agent/todo/explain-1.md:14` (spot-checked) records that on 2026-10-05, in session 8c77b36e, the user pasted the same Karpathy passage — four layers: ASD-STE100 controlled language, draw instead of write, hand over interactive HTML, 3Blue1Brown-style video with local TTS — and asked for "每個任務完成後，看得懂它做了什麼", applied to three places only: the main session's words to the user, AskUserQuestion, and docs. Lines 16-19 record the decisions the user chose question by question:

- Storage: a plain-language completion record under the TODO entry at land time; station cards and the land dialogue read only that.
- Controlled language: write a Chinese controlled-rule page (one thing per sentence, sentence cap, result first, no bare codes, say who did what) **and** have `gateProblem` and docs-check block long sentences and bare codes — "只寫規則不夠".
- Video: Watch, as a separate entry "發版時做講解影片".

State is `done`, sha `ba05309c`, link `skills/fankeel-explain/SKILL.md`. The parent session should relay this first: the user is re-asking a question they already settled, and the files show what came of it.

### Rung 1 — STE writing: already in place; `ste` would duplicate `plain`

Reader 2 (opus) compared `docs/90-agent/reference/plain-language.md` to STE rule by rule. Spot-checked at :9-19: the page names ASD-STE100 as its source at :11 ("做法取自航空維修文件用的受控英語（ASD-STE100）：句子短、一句一件事、用字固定"), and its five rules at :15-19 are one thing per sentence; at most 160 columns (≈80 CJK characters); result before reason; no bare codes; say who did what. Line 9 says rules 2 and 4 are machine-checked whatever style is chosen, on main-session speech, gate questions and options, guide pages, and TODO completion records. Enforcement named at :23-25: `lib/handoff.js` `ruleProblem` → `proseProblem` sends a controlled gate back; docs-check `proseFindings` reports `long-sentence` and `bare-code`.

Of the ten STE rules I listed, present: (a) one topic per sentence, (b) a length cap (160 columns, not 20/25 words), (d) partly (name the actor; passive not banned as such). Absent: paragraph cap, one-meaning-per-word, approved vocabulary, tense/imperative, noun-cluster cap, warnings-before-step, no-gerunds. Those absent rules are the English-aerospace part of STE; the user's reply language is 繁體中文, where word counts and gerunds do not apply and the 160-column cap is the equivalent. That is Karpathy's "80% of the way" already.

Reader 3 found `lib/prose.js:19` (spot-checked) — `STYLES.plain` reads: "One sentence says one thing: two things are two sentences. The result first, then the reason. Name who did what... Short sentences, active voice, one fixed word for one thing, after ASD-STE100 controlled English. Number the steps of a procedure." So the STE-like style already exists under the name `plain`. Adding `ste` would mean: a new key in `STYLES` (:17), `NAMES` (:22), `lib/profile.js:613` values (spot-checked: `['writer','plain','sepia','custom']`), the `profile.md:60` table row, plus `tests/prose.test.js:63` and `tests/prose-profile.test.js:28`, and ~450 characters injected into every non-build stage brief (`lib/render.js:612`) and every writer brief (`:825`). All of that to say what `plain` already says. Reject B-as-new-style.

Reader 1 (opus) on `skills/fankeel-explain/SKILL.md`: it is a chat-reply skill, loaded on demand by its description only (no hook or lib names it; `skills/fankeel/SKILL.md:904` points to it as the voice source). Spot-checked :90-96: "Where the profile's `language` is 繁體中文, prose for the user follows plain-language.md: one thing per sentence, at most 160 columns, the result first, and a name instead of a code. A controlled stage's gate is sent back past either limit (`proseProblem` in `lib/plain.js`)." Its own rules (:17-86) are reader-path rules — conclusion then reason then evidence then example, one message per sentence, confirmed vs inferred vs needs-confirming, delete announcing/recapping sentences. No line mentions diagram, mermaid, svg, image, html, page or video. It covers the writing rung; it has no visual rung, by the 2026-10-05 decision.

**The one unpulled lever.** `F:/ymlab/fankeel/.fankeel/profile.json` has no `prose.style` (my grep: no match), so this project's stage agents and writer run the builtin `writer`. If the user wants stage reports and gate strings in the STE-like voice, the change is one command, no file edit, reversible: `node <plugin>/scripts/task.js profile set prose.style plain`. The cost: ~330 characters in each non-build stage brief and the writer brief (under the 9500 `BRIEF_MAX`, build excluded by design at `lib/render.js:608-612`); zero per turn. The trade-off the user should see first: `docs/90-agent/reports/2026-10-05-prose-styles.md:20-25` measured the same passage at 8 sentences (writer zh, mean 44.9 columns) vs 24 sentences (plain zh, mean 13.7 columns). Plain is shorter per sentence and three times longer in sentence count. For a 120-word survey gate that is a real cost.

### Rung 2 — diagrams: reject as a standing rule; already parked by the user

Reader 7's repo-wide grep: no skill or agent produces a diagram. The only hits are two audit rules that treat a mermaid graph in docs as a stale-listing risk (`skills/fankeel/SKILL.md:525`, `skills/fankeel-audit/SKILL.md:182`), `hooks/pane-svg.ts:50` which draws status rows as SVG for the desktop pane band, and comments in `lib/map.js`/`lib/docs.js` about telling a flow diagram from a tree. `docs/90-agent/todo/docs-1.md` (spot-checked :1-14): "流程圖由腳本生成並防漂移", state `blocked`, timing "after: 使用者在另一個專案把流程圖生成做出來" — on 2026-10-05 the user decided to build flow-diagram generation in another project first and look back afterwards. Open question there: whether to add a dependency (package.json has none). Nothing in fankeel renders mermaid where the human reads a gate (see rung 3). A diagram that genuinely carries a structure can already be drawn in chat as box-drawing text with no rule; reject C as a rule, keep on-request.

### Rung 3 — HTML: on explicit request only, via the path that already exists; not a default output

Reader 6 corrected a naming slip in the brief: `lib/render.js` is the prompt-text renderer (831 lines; it holds the 2400 `BLOCK_CAP` at :667 and the 9500 `BRIEF_MAX` at :729); the screenshot tool is `scripts/render.js` (255 lines, shoots any url or file to `render.png` + `render.html`, `FANKEEL_BROWSER` at :25/:68; `--config` alone reads `.fankeel/render.json`).

Station: a live server on 127.0.0.1:28888 serving registry, route/stage, spend, gates, TODO and docs in a fixed shell (`scripts/station.js:8-11, 697, 723-724`); the gate tab parses fankeel's own stage reports by template (`docs/90-agent/reference/station.md:283-310`); routes at `station.js:462,536` are `/`, `/station/station-data.js`, `/station/search`, `/station/talk/<id>`, `/station/detail/<id>.js`, `/station/shot/<id>.png`, `/station/health` plus five POSTs — no route for an arbitrary page. Not reusable for an explain page.

Mockup agent (`agents/fankeel-mockup.md`, pinned opus at :5): draws from the project's own stylesheets, writes under `.fankeel/build/` (:27-28). Spot-checked :64-85: the page is checked "through a server, never a `file://` url"; `node <plugin>/scripts/tune.js serve <dir>` from the project root, curl every stylesheet, `scripts/render.js <served url>`, "Leave the server running — the url you return is the one the user opens." That serve-check-handback path is the one reusable piece: it works for any HTML under `.fankeel/build/`. The agent itself is design-specific (data-block on every block, opus at high effort) — the wrong tool for a discardable explainer.

Render reviewer: build/verify only, needs a mockup and `data-block` markup, outputs a disposition. Not reusable.

So D is possible with zero new code: when the user asks for a page, the session (or fankeel-explain) writes `.fankeel/build/task-<started>/explain.html`, runs `tune.js serve`, hands back the url. The honest reading of the 2026-10-05 decision is that HTML got no home then and nobody has asked since (no TODO, no plan, no judgement — reader 8 and reader 5). Do not make it a default: the station is already the HTML of the registry, gate text is capped at 120 words by design, and a page nobody opens costs an opus-class write. If the user wants the door open, the cheapest shape is a ~6-line "When asked for a page" section appended to `skills/fankeel-explain/SKILL.md` after :96, pointing at `agents/fankeel-mockup.md:70-85`'s serve/check steps — an on-demand skill, so zero per-turn cost. I would not make even that change until the user asks for a page once.

### Rung 4 — video: reject building; the trigger is already written down

`docs/90-agent/todo/explain-2.md` (spot-checked :1-12): "發版時做講解影片", state `watch`, link `scripts/tour-record.js`, timing "if: 發版或對外展示需要一條講解影片". Rationale recorded: a video per task costs too much; when a release or demo needs one, make it from that version's completion records with `scripts/tour-record.js` + local TTS, record the time and money, then decide whether it becomes a standing step. When that trigger fires, the installed `launch-video` plugin is a route choice alongside tour-record.js. Nothing to add.

### Why not a standing rule anywhere

Reader 4 established that `hooks/brief.js` is the SubagentStart hook (:4, :171), not the per-turn injection; the per-turn block is `hooks/inject.js:259` → `render()` in `lib/render.js`, capped by `BLOCK_CAP = 2400` (:667). Spot-checked `lib/render.js:281-283`: "The rule block sits 3–34 characters under its cap with no profile at all"; `docs/90-agent/reference/registry.md:241-242` (spot-checked): widest stage `land` renders at 2397 of 2400. Any new per-turn line means cutting another. Reader 8 found the standing principle at `skills/fankeel-ask/SKILL.md:33-41` (spot-checked): "No rule mentions it... a line riding every prompt... is an invitation to defer to it... The user knows this command exists; the session does not get told." The same logic applies to every rung here: the user triggers it; nothing advertises it.

Reader 7 on the gate surface (`skills/fankeel-survey/SKILL.md:397-413`, spot-checked): the Output is a fixed bullet template then `AskUserQuestion`, "Under 120 words of your own"; verify's is a fenced `$ <command>` block plus held/did-not-hold bullets (:315-325). Neither skill mentions language, diagram, HTML, browser or pane. A patrol prints its entry list above the gate (:334-336). That is what a human reads: short structured text in an AskUserQuestion. A mermaid block or an HTML file would not render there.

### Table: rung → verdict → where → cost

| Rung | Verdict | Where in fankeel | Cost |
|---|---|---|---|
| 1. STE writing | Already adopted 2026-10-05; reject a new `ste` style | plain-language.md:15-19 (ASD-STE100 at :11); lib/plain.js checks on every style; lib/prose.js:19 `plain`; fankeel-explain:92-96 | 0 new code. Optional one command: `task.js profile set prose.style plain` — ~330 chars per non-build stage brief and writer brief, 0 per turn; reports get ~3× more sentences |
| 2. Diagrams | Reject as a rule; on-request only | docs-1 (blocked by the user's own choice); no gate surface renders mermaid; audit treats mermaid in docs as drift risk (skills/fankeel/SKILL.md:525) | 0; box-drawing text in chat needs no rule |
| 3. HTML | Not a default output; on explicit request reuse mockup's serve/check path | agents/fankeel-mockup.md:70-85 (`tune.js serve`, `scripts/render.js`); write under `.fankeel/build/`; station has no arbitrary-page route | 0 now; if the user asks once: ~6 lines after fankeel-explain:96, 0 per turn |
| 4. Video | Reject building; trigger already recorded | explain-2 (watch): release/demo → `scripts/tour-record.js` + local TTS; `launch-video` plugin is a route option then | 0 |

### Concrete first change

None in code. The session should tell the user, in 繁體中文: 這四層在 2026-10-05 已經討論並定案（explain-1 已完成；影片在 explain-2 看守；流程圖在 docs-1 被使用者自己擋住）。唯一還沒拉的開關是 `prose.style`，這個專案沒設，所以站 agent 和 writer 用的是 `writer` 不是 `plain`。If the user wants to try the STE-like voice on stage reports, run `node <plugin>/scripts/task.js profile set prose.style plain` and watch one survey gate; revert with `profile set prose.style writer` if the 24-vs-8 sentence cost shows. If the user wants a page some day, ask for it by name; the serve/check path at mockup.md:70-85 already works, and a six-line section in fankeel-explain can be added after the first real request.

### Explicitly rejected, and why

- A `ste` value for `prose.style`: duplicates `plain` (prose.js:19 already cites ASD-STE100), costs 4 code sites + 2 tests, and English word caps do not apply to 繁體中文.
- Full STE (approved dictionary, 20/25-word caps, no gerunds): aerospace-English rules; the user's language and the 160-column check already give the 80%.
- A diagram or HTML rule in the per-turn block: 3 characters of headroom at 2400; and the fankeel-ask principle — nothing rides every prompt to advertise an on-request capability.
- fankeel-explain producing HTML by default: no reader surface at the gate, the station already is the registry's HTML, an unopened page is wasted opus-class work.
- Building a video rung: explain-2 already holds it with a cost-first trigger the user set.

### What I could not check

- Whether Claude Code's desktop app renders mermaid or inline HTML in chat (would make C free; not in this repo).
- `lib/plain.js`, `lib/handoff.js` `ruleProblem`, `lib/stages.js` `controlRules` — readers confirmed the symbols exist and plain-language.md describes them; I did not open the code.
- `docs/99-archive/2026-10-05-prose-style-design.md` — the design behind the three styles; reader 3 noted it but did not open it.
- Whether the user has a `launch-video` trigger in mind now (brief says treat it as routable only).
- Naming note for filing: `docs/judgements/` does not exist; the judgements directory is `F:/ymlab/fankeel/docs/90-agent/judgements/` (27 files). Also the brief's "`lib/render.js` / render reviewer" conflates two files — `lib/render.js` renders prompt text; `scripts/render.js` takes screenshots.
