'use strict';

// What compaction has already cost. The transcript records it exactly, so the
// only ways to be wrong here are to read the wrong number or to read nothing —
// and reading nothing is the dangerous one, because a session that has dropped a
// million tokens then looks like a session that has never compacted.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ctx = require('../lib/context.js');
const tmp = require('./tmp.js');

const BS = String.fromCharCode(92);   // the escaping is the subject; spell it out

function transcript(lines) {
  const dir = tmp('fankeel-ctx-');
  const file = path.join(dir, 'session.jsonl');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

// A real usage record, unescaped: it is a field on the transcript line itself.
const usage = (read) => '{"type":"assistant","message":{"usage":{"input_tokens":2,'
  + '"cache_creation_input_tokens":2362,"cache_read_input_tokens":' + read + ',"output_tokens":275}}}';

// A real compaction record. `compactMetadata` arrives nested inside a
// stringified payload, so on disk its quotes are escaped — which is exactly what
// a pattern written from the pretty-printed form fails to match.
const compaction = (dropped) => '{"type":"system","subtype":"compact_boundary","content":"'
  + BS + '"compactMetadata' + BS + '":{' + BS + '"trigger' + BS + '":' + BS + '"manual' + BS + '",'
  + BS + '"preTokens' + BS + '":479852,' + BS + '"postTokens' + BS + '":24905,'
  + BS + '"cumulativeDroppedTokens' + BS + '":' + dropped + '}"}';

test('a session that has never compacted says nothing', () => {
  const file = transcript([usage(285214)]);
  const info = ctx.inspect(file);
  assert.equal(info.dropped, 0);
  assert.equal(info.used, 285214 + 2362 + 2);
  assert.equal(ctx.contextLine(info), null);
});

// The bug this test exists for: the pattern matched the pretty-printed form and
// found nothing in the file, reporting a clean session — the most reassuring
// possible way to be wrong.
test('the escaped form is what is on disk, and it is read', () => {
  const file = transcript([usage(285214), compaction(326893)]);
  assert.equal(ctx.inspect(file).dropped, 326893);
});

test('the running total is the last one, not the sum of them', () => {
  // cumulativeDroppedTokens is already cumulative; adding them up would report
  // a session three times worse than it is.
  const file = transcript([compaction(326893), usage(1), compaction(665251), usage(2), compaction(1120198)]);
  assert.equal(ctx.inspect(file).dropped, 1120198);
});

test('the line names what was lost and how to carry the task over', () => {
  const line = ctx.contextLine({ dropped: 326893, used: 287578 });
  assert.match(line, /327k tokens dropped/);
  assert.match(line, /288k in play/);
  assert.match(line, /fourth option, hand off: set next/);
  assert.match(line, /set next with task\.js next --handoff --from-gate, then a new terminal/);
  assert.match(line, /\/fankeel → Adopt/);
  // Not yet the stronger wording: one compaction is a fact, not an emergency.
  assert.doesNotMatch(line, /Start a fresh session before the next one/);
});

// The id is disclosed in the `init` block, which a session only sees while it
// has no task. Once it has one the block never repeats it — so the session that
// most needs it is the one that cannot get it: after a compaction the id is out
// of context, and every `task.js` call needs `--session <id>`.
//
// It rides the compaction line rather than the block, because that line only
// appears once something has been dropped, which is exactly the case. A session
// that has never compacted still has the id where it first saw it, and pays
// nothing.
test('a compacted session is told the id every task.js call needs', () => {
  const id = 'aaaaaaaa-1111-2222-3333-444444444444';
  const line = ctx.contextLine({ dropped: 326893, used: 287578 }, id);
  assert.match(line, new RegExp(id));
  assert.match(line, /--session/, 'the id alone is not the thing that was forgotten');

  // Nothing dropped, nothing to have forgotten: the busy line stays as it was.
  const busy = ctx.contextLine({ dropped: 0, used: ctx.BUSY }, id);
  assert.doesNotMatch(busy, new RegExp(id));

  // And a caller with no id to pass still gets the line it always got.
  assert.doesNotMatch(ctx.contextLine({ dropped: 326893, used: 287578 }), /--session/);
});

test('past a million dropped it stops being a note and starts being advice', () => {
  const line = ctx.contextLine({ dropped: 1120198, used: 307734 });
  assert.match(line, /1\.1M tokens dropped/);
  assert.match(line, /Start a fresh session before the next one/);
});

test('an unreadable transcript costs nothing and says nothing', () => {
  assert.equal(ctx.inspect(path.join(os.tmpdir(), 'fankeel-does-not-exist.jsonl')), null);
  assert.equal(ctx.inspect(''), null);
  assert.equal(ctx.inspect(null), null);
  assert.equal(ctx.inspect(undefined), null);
  assert.equal(ctx.contextLine(null), null);
});

test('only the tail is read, however long the session ran', () => {
  const filler = new Array(400).fill('{"type":"user","content":"' + 'x'.repeat(2000) + '"}');
  const file = transcript([compaction(999999)].concat(filler, [usage(120000)]));
  assert.ok(fs.statSync(file).size > ctx.TAIL, 'the fixture has to be longer than the tail');

  // The compaction is off the front of the window, so it reads as none. That is
  // the deliberate failure: a compaction that far back means a great deal has
  // happened since without another one.
  const info = ctx.inspect(file);
  assert.equal(info.dropped, 0);
  assert.equal(info.used, 120000 + 2362 + 2);
});

test('the render block carries the line only when there is one', () => {
  const { render } = require('../lib/render.js');
  const now = Date.now();
  const mine = { sessionId: 'a', data: { task: 'x', scope: ['a.js'], stage: 'build', active: true, updated: new Date(now).toISOString() } };
  const base = { mine, others: [], now, root: 'F:/x', launch: 'F:/x' };

  const quiet = render(Object.assign({}, base, { transcript: transcript([usage(1000)]) }));
  assert.doesNotMatch(quiet, /context:/);

  const loud = render(Object.assign({}, base, { transcript: transcript([usage(1000), compaction(500000)]) }));
  assert.match(loud, /context: 500k tokens dropped/);

  // No transcript at all is the ordinary case for anything calling render
  // directly, and it must not change what comes out.
  assert.doesNotMatch(render(base), /context:/);
});

// The other half of the same block-carrying question: the post-answer block
// gets the line too now, from the same transcript, threaded through the same
// way render() already was.
test('renderResume carries the line only when there is one', () => {
  const { renderResume } = require('../lib/render.js');
  const mine = { sessionId: 'a', data: { task: 'x', stage: 'build', active: true, updated: new Date().toISOString() } };

  const quiet = renderResume({ mine, transcript: transcript([usage(1000)]) }) || '';
  assert.doesNotMatch(quiet, /context:/);

  const loud = renderResume({ mine, transcript: transcript([usage(1000), compaction(500000)]) }) || '';
  assert.match(loud, /context: 500k tokens dropped/);

  // No transcript at all must not change what comes out.
  assert.doesNotMatch(renderResume({ mine }) || '', /context:/);
});

// Waiting for the first compaction means the warning always arrives after the
// loss. 400k is the line, set from a session that sat around 300k doing ordinary
// work.
test('a busy session is warned before it loses anything', () => {
  assert.equal(ctx.contextLine({ dropped: 0, used: 308000 }), null);
  const line = ctx.contextLine({ dropped: 0, used: ctx.BUSY });
  assert.match(line, /400k in play, nothing dropped yet/);
  assert.match(line, /fourth option, hand off: set next/);
  assert.match(line, /\/fankeel → Adopt/);
});

test('once something has been dropped, that is what gets reported', () => {
  const line = ctx.contextLine({ dropped: 326893, used: 420000 });
  assert.match(line, /327k tokens dropped/);
  assert.doesNotMatch(line, /nothing dropped yet/);
});

// The host compacts on its own once a window is set. One session grew from
// 450k to 629k uncompacted, and nothing said that no window was set.
test('a busy session with no auto-compact window is told nothing will compact it', () => {
  const info = { dropped: 0, used: ctx.BUSY };
  assert.doesNotMatch(ctx.contextLine(info), /auto-compact window/);
  assert.match(ctx.contextLine(info, null, {}),
    /nothing dropped yet\. This stage's gate gets a fourth option.*Adopt\. No auto-compact window is set.*CLAUDE_CODE_AUTO_COMPACT_WINDOW, or \/compact\)\.$/);
  assert.match(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '0' }), /No auto-compact window is set/);
  assert.match(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: 'off' }), /No auto-compact window is set/);
  assert.doesNotMatch(ctx.contextLine(info, null, { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '450000' }), /auto-compact window/);
  // a session that has compacted before keeps the line it had, busy or not
  assert.doesNotMatch(ctx.contextLine({ dropped: 500000, used: ctx.BUSY }, 'abc', {}), /auto-compact window/);
  assert.doesNotMatch(ctx.contextLine({ dropped: 500000, used: 1000 }, 'abc', {}), /auto-compact window/);
  assert.equal(ctx.contextLine({ dropped: 0, used: ctx.BUSY - 1 }, null, {}), null);
});

test('both blocks read the window from the hook\'s own environment', () => {
  const { render, renderResume } = require('../lib/render.js');
  const now = Date.now();
  const mine = { sessionId: 'a', data: { task: 'x', scope: ['a.js'], stage: 'build', active: true, updated: new Date(now).toISOString() } };
  const file = transcript([usage(ctx.BUSY)]);
  const block = () => render({ mine, others: [], now, root: 'F:/x', launch: 'F:/x', transcript: file });
  const resume = () => renderResume({ mine, transcript: file }) || '';
  const saved = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  try {
    delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    assert.match(block(), /No auto-compact window is set/);
    assert.match(resume(), /No auto-compact window is set/);
    process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '450000';
    assert.match(block(), /context: 40\dk in play/);
    assert.doesNotMatch(block(), /auto-compact window/);
    assert.doesNotMatch(resume(), /auto-compact window/);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    else process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = saved;
  }
});

// compact-5: hooks/compact.ts compacts at the profile's compact.at, so a tier a
// profile file set is a window of its own. The built-in tier is nobody's choice.
test('a tier the profile set stands in for the window; off and no tier do not', () => {
  const info = { dropped: 0, used: ctx.BUSY };
  for (const at of ['350000', '450000', '600000', '1000000', 350000]) {
    assert.doesNotMatch(ctx.contextLine(info, null, {}, at), /auto-compact window/, String(at));
  }
  for (const at of ['off', undefined, null, '123']) {
    assert.match(ctx.contextLine(info, null, {}, at), /No auto-compact window is set/, String(at));
  }
});

test('both blocks pass the tier a profile file set, never the built-in one', () => {
  const { render, renderResume } = require('../lib/render.js');
  const now = Date.now();
  const mine = { sessionId: 'a', data: { task: 'x', scope: ['a.js'], stage: 'build', active: true, updated: new Date(now).toISOString() } };
  const file = transcript([usage(ctx.BUSY)]);
  const profileOf = (source) => ({ values: { 'compact.at': '350000' }, sources: { 'compact.at': source } });
  const block = (source) => render({ mine, others: [], now, root: 'F:/x', launch: 'F:/x', transcript: file, profile: profileOf(source) });
  const resume = (source) => renderResume({ mine, transcript: file, profile: profileOf(source) }) || '';
  const saved = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  try {
    delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    for (const source of ['project', 'machine']) {
      assert.doesNotMatch(block(source), /auto-compact window/, source);
      assert.doesNotMatch(resume(source), /auto-compact window/, source);
    }
    assert.match(block('builtin'), /No auto-compact window is set/);
    assert.match(resume('builtin'), /No auto-compact window is set/);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    else process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = saved;
  }
});

// A row that quotes a transcript: a tool result whose text carries a usage
// record and a dropped count. On disk its quotes are escaped once, which is the
// form the old patterns were written to accept.
const quoted = (read, dropped) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{
  type: 'tool_result',
  content: '{"usage":{"input_tokens":2,"cache_creation_input_tokens":2362,"cache_read_input_tokens":' + read + '}} "cumulativeDroppedTokens":' + dropped,
}] } });

test('a usage and a dropped count quoted in a tool result are not this session\'s', () => {
  const file = transcript([usage(40000), compaction(326893), quoted(650000, 1120198)]);
  const info = ctx.inspect(file);
  assert.equal(info.used, 40000 + 2362 + 2);
  assert.equal(info.dropped, 326893);
});

test('quoted figures alone are no reading at all', () => {
  assert.equal(ctx.inspect(transcript([quoted(650000, 1120198)])), null);
});

test('a usage on a row that is not an assistant row, and a dropped count on one that is not a compact_boundary, do not count', () => {
  const stray = JSON.stringify({type: 'progress',message: {usage: {input_tokens: 999999}}});
  const note = '{"type":"system","subtype":"informational","content":"' + BS + '"cumulativeDroppedTokens' + BS + '":777}"}';
  const info = ctx.inspect(transcript([usage(40000), stray, note]));
  assert.equal(info.used, 40000 + 2362 + 2);
  assert.equal(info.dropped, 0);
});

// Rows that carry the text `compact_boundary` and a dropped count without being
// the system row of that subtype: a tool result quoting one, a system row of
// another subtype that names it, a row of that subtype that is not a system
// row, and the tail's first line, cut mid-row so it does not parse.
const mention = (dropped) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{
  type: 'tool_result',
  content: 'a compact_boundary row reads "cumulativeDroppedTokens":' + dropped,
}] } });
const aside = (dropped) => JSON.stringify({ type: 'system', subtype: 'informational',
  content: 'the last compact_boundary said "cumulativeDroppedTokens":' + dropped });
const posed = (dropped) => JSON.stringify({ type: 'user', subtype: 'compact_boundary',
  content: '"cumulativeDroppedTokens":' + dropped });
const torn = (dropped) => compaction(dropped).slice(9);

test('a row that names compact_boundary and carries a dropped count, and is not that system row, is not a compaction', () => {
  for (const [name, row] of [['a tool result', mention(1120198)], ['another subtype', aside(1120198)], ['another type', posed(1120198)], ['a cut line', torn(1120198)]]) {
    assert.ok(row.includes('compact_boundary') && /cumulativeDroppedTokens/.test(row), name + ' does not reach the row check');
    const info = ctx.inspect(transcript([usage(40000), compaction(326893), row]));
    assert.equal(info.dropped, 326893, name + ' was read as a compaction');
    assert.equal(ctx.inspect(transcript([usage(40000), row])).dropped, 0, name + ' alone was read as a compaction');
  }
});

// gate.away: strictly more than AWAY tokens in play earns the line.
test('awayLine: over 200k names /compact, exactly 200k and under say nothing, no info says nothing', () => {
  assert.equal(ctx.AWAY, 200000);
  assert.match(ctx.awayLine({ dropped: 0, used: 200001 }), /\/compact/);
  assert.equal(ctx.awayLine({ dropped: 0, used: 200000 }), null);
  assert.equal(ctx.awayLine({ dropped: 0, used: 150000 }), null);
  assert.equal(ctx.awayLine(null), null);
});

test('AWAY_QUESTION is headed 離開 and offers not leaving and leaving with the work going on', () => {
  assert.equal(ctx.AWAY_QUESTION.header, '離開');
  assert.deepEqual(ctx.AWAY_QUESTION.options.map((o) => o.label), ['不離開', '要離開，繼續做']);
});
