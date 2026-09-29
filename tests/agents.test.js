'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier', 'fankeel-fixer', 'fankeel-brain', 'fankeel-render-reviewer', 'fankeel-mockup'];

// `fankeel-verifier` is the one named exception: it writes evidence rows to a
// file for the Workflow join, and `Write` is what that takes. It is not less
// constrained than the other three for holding it — `guard.js`'s PreToolUse
// hook matches `Edit|Write|NotebookEdit` (`.claude-plugin/plugin.json`), so
// `Write` is guarded; `Bash`, which seven of the eight hold, is matched by a
// second `guard.js` entry (matcher `Bash|PowerShell`) for four of them —
// `fankeel-reader`, `fankeel-reviewer`, `fankeel-judge` and
// `fankeel-render-reviewer` — not `fankeel-verifier` or `fankeel-brain`, per
// `lib/guard.js`'s `readOnlyAgentType` list.
// `fankeel-fixer` is the second named exception: it makes the small edit
// itself rather than returning it for the parent to apply, so it needs both
// `Edit` and `Write` — never `Bash`, so it never runs the test the edit would
// need.
// `fankeel-brain` is the third: it writes its handoff — the report and gate
// block a controller hands on by path (`lib/handoff.js`) — and, on a build
// stage, the commit file its controller commits from, so it takes `Write` and
// nothing that edits in place.
// `fankeel-mockup` is the fourth: it draws the design stage's mockup page and,
// in a tuning loop, rewrites the one block it is sent — `Edit` and `Write` on
// that page, which is the whole of its job.
const MAY_WRITE = { 'fankeel-verifier': ['Write'], 'fankeel-fixer': ['Edit', 'Write'], 'fankeel-brain': ['Write'], 'fankeel-mockup': ['Edit', 'Write'] };

function front(file) {
    const m = FRONT.exec(fs.readFileSync(file, 'utf8'));
    assert.ok(m, file + ' has frontmatter');
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([\w-]+):\s*(.*)$/.exec(line);
        if (kv) out[kv[1]] = kv[2];
    }
    return out;
}

test('every agent parses, names itself after its file, and cannot edit', () => {
    for (const name of NAMES) {
        const f = front(path.join(ROOT, 'agents', name + '.md'));
        assert.equal(f.name, name);
        assert.match(f.tools, /^\[.+\]$/, name + ' tools is a list');
        const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
        assert.ok(tools.length > 0, name + ' tools is not empty — an empty list refuses to launch');
        const allowed = MAY_WRITE[name] || [];
        for (const banned of ['Edit', 'Write', 'NotebookEdit']) {
            if (allowed.includes(banned)) continue;
            assert.ok(!tools.includes(banned), name + ' lists ' + banned);
        }
        assert.ok(f.model, name + ' pins a model');
    }
});

test('the manifest ships them all, and no others', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.deepEqual(manifest.agents, NAMES.map((n) => './agents/' + n + '.md'));
    for (const rel of manifest.agents) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    assert.deepEqual(fs.readdirSync(path.join(ROOT, 'agents')).sort(), NAMES.map((n) => n + '.md').sort());
});

// The five cut tags are defined here once. Build's Part 4 and audit's code
// half both point at this section rather than restating it, so a tag that
// went missing here would go missing from both.
test('the reviewer carries the cut tags build and audit ask for', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Cuts$/m);
    for (const tag of ['delete:', 'stdlib:', 'native:', 'yagni:', 'shrink:']) {
        assert.ok(text.includes('`' + tag + '`'), 'the reviewer does not define ' + tag);
    }
    assert.match(text, /net: -<N> lines possible\./);
    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
    assert.match(build, /Part 4 — cuts/);
});

// The security lens: four classes adapted from cloudflare/security-audit-skill,
// defined here once and asked for by verify's adversary.
test('the reviewer carries the security lens and verify asks for it once', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Security$/m);
    const lens = text.split('\n## Security\n')[1].split('\n## ')[0];
    for (const tag of ['inject:', 'access:', 'file:', 'secret:']) assert.ok(lens.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(lens, /security: <N> findings\./);
    const verify = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(verify, /`## Security` lens/);
});

test('the security-lens eval case parses, with a grader on the sink and one on the dispatch', () => {
    const ev = require('../lib/eval.js');
    const c = ev.parseCase(path.join(ROOT, 'evals', 'security-lens'));
    assert.equal(c.name, 'security-lens');
    assert.equal(c.graders.length, 2);
});

// The render lens moved out of the reviewer into its own agent on 2026-09-23
// (docs/decisions/2026-09-23-render-review.md). The new agent needs Bash for
// scripts/render.js; the reviewer no longer does, and still saying so would
// hand it a tool its job no longer uses.
test('the render reviewer carries the rendering contract; the reviewer no longer does', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-render-reviewer.md'), 'utf8');
    for (const h of ['## Tools', '## Input', '## Evidence', '## Matrix', '## Return']) {
        assert.match(text, new RegExp('^' + h + '$', 'm'), 'no ' + h);
    }
    const tools = text.split('\n## Tools\n')[1].split('\n## ')[0];
    assert.match(tools, /scripts\/render\.js/);
    for (const word of ['recapture', 'fix', 'ship']) assert.ok(text.includes('`disposition: ' + word + '`'), 'no disposition ' + word);
    assert.equal(front(path.join(ROOT, 'agents', 'fankeel-render-reviewer.md')).model, 'sonnet');
    const reviewer = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.doesNotMatch(reviewer, /^## Render$/m);
    assert.doesNotMatch(reviewer.split('\n## Tools\n')[1].split('\n## ')[0], /render\.js/);
});

// Each sentence is pinned to its own Part: one moved into another Part fails.
test('the reviewer template asks Part 2 for a control and Part 3 for the page made false', () => {
    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
    const part2 = build.split('Part 2 —')[1].split('Part 3 —')[0];
    const part3 = build.split('Part 3 —')[1].split('Part 4 —')[0];
    assert.match(part2, /has never failed/);
    assert.match(part2, /must reject/);
    assert.match(part3, /makes false/);
    assert.match(part3, /page:line/);
});

// A reader that sends one call per turn reads like a slow pipeline; what is
// slow is the turn count, not git.
test('the reader is told to send reads that do not depend on each other in one response', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const searching = text.split('\n## Searching\n')[1].split('\n## ')[0];
    assert.match(searching, /same response/);
});

test('the stage agent writes its handoff and dispatches readers, on sonnet', () => {
    const f = front(path.join(ROOT, 'agents', 'fankeel-brain.md'));
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Agent'), 'it dispatches its readers');
    assert.ok(tools.includes('Write'), 'it writes its handoff');
    assert.ok(!tools.includes('Edit'), 'it changes no source');
    // Design and plan run on opus: the controller's dispatch passes `model: opus`, which replaces this pin.
    assert.equal(f.model, 'sonnet');
    // At the session's `high` it thought 2.5–4× what the main session did over the same survey.
    assert.equal(f.effort, 'medium');
});

// Its brief says to read cited lines with `sed -n` in one Bash call; a Tools
// section keeping Bash to git and the plugin's scripts would forbid exactly that.
test('the stage agent may read with sed in Bash', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const tools = text.split('\n## Tools\n')[1].split('\n## ')[0];
    assert.match(tools, /`sed -n`/);
});

test('the stage agent ends its turn with the single word waiting rather than polling', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /end your turn with the single word `waiting`/);
    assert.match(ret, /never wait by polling/);
    assert.doesNotMatch(ret, /never while an agent you dispatched is still running/);
});

// docs/plans/2026-09-23-controller-await-design.md §2: the wait rule cites the
// run that showed it works, and names the one channel a return travels by.
test('the stage agent\'s Return section cites the wake-up report and names SubagentHandback', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /\(\.\.\/docs\/90-agent\/reports\/2026-09-23-brain-wakeup\.md\)/);
    assert.ok(fs.existsSync(path.join(ROOT, 'docs', '90-agent', 'reports', '2026-09-23-brain-wakeup.md')));
    assert.match(ret, /only through `SubagentHandback`/);
});

// docs/plans/2026-09-26-station-redesign.md Task 2: the mockup has its own
// agent, pinned to opus, and the design skill sends both of its dispatches
// there by type rather than as an implementer at a model.
test('the mockup agent is pinned to opus and the design skill dispatches it by type', () => {
    const f = front(path.join(ROOT, 'agents', 'fankeel-mockup.md'));
    assert.equal(f.model, 'opus');
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Skill'), 'the agent loads the named design skill itself');
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8');
    const step3 = design.split('### 3. The mockup')[1].split('### 4.')[0].replace(/\s+/g, ' ');
    assert.equal((step3.match(/`subagent_type: fankeel:fankeel-mockup`/g) || []).length, 2, 'drawing and tuning both go to the agent');
    assert.doesNotMatch(step3, /implementer at `design\.mockup`'s model/);
    assert.doesNotMatch(step3, /Dispatch it as `implementer, <the value of design\.mockup>`/);
});

// docs/90-agent/plans/2026-09-27-five-items-design.md §5: a mockup once
// passed a file:// screenshot while the url the user was given 404'd every
// stylesheet above the served directory. The agent checks the page where the
// user will open it, and the design skill hands the user that checked url.
test('the mockup agent checks its page at the served url before returning it, and the design skill hands the user that url', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mockup.md'), 'utf8');
    const check = text.split('\n## Check it served\n')[1];
    assert.ok(check, 'agents/fankeel-mockup.md has a ## Check it served section');
    const body = check.split('\n## ')[0].replace(/\s+/g, ' ');
    assert.match(body, /`node <plugin>\/scripts\/tune\.js serve <dir>`/);
    assert.match(body, /`node <plugin>\/scripts\/render\.js <the served url>`/);
    assert.match(body, /anything not `200`/);
    assert.match(body, /never a `file:\/\/` url/);
    const ret = text.split('\n## Return\n')[1].replace(/\s+/g, ' ');
    assert.match(ret, /The served url you checked/);
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8');
    const step3 = design.split('### 3. The mockup')[1].split('### 4.')[0].replace(/\s+/g, ' ');
    assert.match(step3, /the url the agent returned/);
    assert.doesNotMatch(step3, /tune\.js serve <the mockup's directory>/);
});

// docs/plans/2026-09-26-station-redesign.md Task 3. The effort each role runs
// at, pinned per agent; none at `max`, which the user observed over-reasons
// (2026-09-26). `fankeel-brain` already carried `medium`.
const EFFORT = {
    'fankeel-reader': 'medium', 'fankeel-reviewer': 'medium', 'fankeel-verifier': 'medium',
    'fankeel-render-reviewer': 'medium', 'fankeel-fixer': 'low', 'fankeel-judge': 'xhigh',
    'fankeel-brain': 'medium', 'fankeel-mockup': 'high',
};
test('every agent names its effort, and none of them is max', () => {
    for (const name of NAMES) {
        const f = front(path.join(ROOT, 'agents', name + '.md'));
        assert.ok(f.effort, name + ' names no effort');
        assert.notEqual(f.effort, 'max', name + ' runs at max');
        assert.equal(f.effort, EFFORT[name], name);
    }
});

// The silent-failure and comment lenses: defined here once, and asked for by
// build's per-task dispatch and verify's adversary through scripts/lenses.js.
// docs/99-archive/2026-09-27-registry-lenses-design.md §5.
test('the reviewer carries the silent-failure and comment lenses, and build and verify run scripts/lenses.js before dispatching', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Silent failure$/m);
    assert.match(text, /^## Comment$/m);
    const silent = text.split('\n## Silent failure\n')[1].split('\n## ')[0];
    for (const tag of ['swallow:', 'unlogged:', 'broad:']) assert.ok(silent.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(silent, /silent-failure: <N> findings\./);
    const comment = text.split('\n## Comment\n')[1].split('\n## ')[0];
    for (const tag of ['stale:', 'unwritten:']) assert.ok(comment.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(comment, /comment: <N> findings\./);

    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(build, /scripts\/lenses\.js/);
    assert.match(build, /`## Silent failure` lens/);
    assert.match(build, /`## Comment` lens/);
    const verify = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(verify, /scripts\/lenses\.js/);
    assert.match(verify, /`## Silent failure` lens/);
    assert.match(verify, /`## Comment` lens/);
});

// docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: the main return,
// the security lens and the silent-failure lens each end a finding line
// `— fails when <input> → <wrong result>`; cuts and the comment lens do
// not change.
test('the main return, the security lens and the silent-failure lens all end their finding line with fails when', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /fails when <the input or state> → <the wrong result>/);
    const security = text.split('\n## Security\n')[1].split('\n## ')[0];
    assert.match(security, /<the fix> — fails when <the input or state> → <the wrong result>\./);
    const silent = text.split('\n## Silent failure\n')[1].split('\n## ')[0];
    assert.match(silent, /<the fix> — fails when <the input or state> → <the wrong result>\./);
    const cuts = text.split('\n## Cuts\n')[1].split('\n## ')[0];
    assert.doesNotMatch(cuts, /fails when/);
    const comment = text.split('\n## Comment\n')[1].split('\n## ')[0];
    assert.doesNotMatch(comment, /fails when/);
});

// docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: four exclusions
// apply to every lens, not only security's.
test('a general exclusion list covers every lens: pre-existing issues, linter catches, style nits, silenced lines', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Never a finding$/m);
    const never = text.split('\n## Never a finding\n')[1].split('\n## ')[0];
    assert.match(never, /predates this diff/);
    assert.match(never, /linter/);
    assert.match(never, /style/);
    assert.match(never, /eslint-disable/);
    assert.match(never, /noqa/);
});

// docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: after a first
// round returns any finding, one more reviewer confirms the whole list in
// one pass before build or verify acts on it.
test('the reviewer carries a Verify mode, and build and verify send a first round\'s findings there before fixing', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Verify$/m);
    const verify = text.split('\n## Verify\n')[1].split('\n## ')[0];
    assert.match(verify, /CONFIRMED/);
    assert.match(verify, /PLAUSIBLE/);

    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(build, /`## Verify` mode/);
    assert.match(build, /never one reviewer per finding/);

    const verifySkill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(verifySkill, /`## Verify` mode/);
    assert.match(verifySkill, /not one per row/);
});

// docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: hard exclusions
// and precedents adapted from claude-code-security-review, with a
// confidence score and a floor below which a finding is dropped rather
// than printed. The design's own count (17 hard exclusions, 10
// precedents) does not match the source repository's (16 and 17); this
// carries the source's real counts.
test('the security lens carries a confidence score, hard exclusions and precedents adapted from claude-code-security-review, dropped below 0.7', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    const security = text.split('\n## Security\n')[1].split('\n## ')[0];
    assert.match(security, /conf: 0\.x/);
    assert.match(security, /drop anything below `conf: 0\.7`/);
    assert.match(security, /anthropics\/claude-code-security-review/);
    assert.match(security, /claude_api_client\.py/);
    assert.match(security, /prompts\.py/);
    assert.match(security, /\(MIT\)/);
    assert.match(security, /^Hard exclusions:/m);
    assert.match(security, /^Precedents:/m);
    for (const phrase of ['UUID', 'environment variable or a CLI flag', 'open redirect', 'Jupyter notebook']) {
        assert.ok(security.includes(phrase), 'the precedents do not mention ' + phrase);
    }
});

test('the security-lens-exclude eval case parses, with a grader on the exclusion and one on the dispatch', () => {
    const ev = require('../lib/eval.js');
    const c = ev.parseCase(path.join(ROOT, 'evals', 'security-lens-exclude'));
    assert.equal(c.name, 'security-lens-exclude');
    assert.equal(c.graders.length, 2);
});

// design §4: a reader's return is read by a long-running parent, and "the
// map shows an edge here" is a claim someone else has to be able to check —
// which line was read, and whether it was read at all or worked out from
// what was.
test('the reader marks every line EXTRACTED or INFERRED, and writes a relationship as A --rel--> B at=file:line', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.ok(ret, 'no ## Return section');
    assert.match(ret, /`EXTRACTED`/);
    assert.match(ret, /`INFERRED`/);
    assert.match(ret, /A --rel--> B at=file:line/);
});

test('the stage agent\'s Return section says a group writes no gate, and only build close does', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /a group rather than `build close`, the handoff path is that group's own — no/);
    assert.match(ret, /only `build close` runs the full suite, writes the gate/);
});

test('the stage agent\'s Return section forbids any return while a dispatched agent has not returned', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /never while an agent you dispatched has not returned — end the turn with `waiting` until it has/);
});

test('the brain\'s own Tools section describes dispatching a fresh implementer on a relay path, and the shared prefix at the head of every prompt', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const tools = text.split('\n## Tools\n')[1].split('\n## Refusals\n')[0];
    assert.match(tools, /relay-<agentId>\.md/);
    assert.match(tools, /relayPath\(root, data, agentId\)/);
    assert.match(tools, /brief --group <N> --prefix/);
    assert.match(tools, /in the same response/);
});
