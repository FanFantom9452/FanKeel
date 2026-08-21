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

const BS = String.fromCharCode(92);   // the escaping is the subject; spell it out

function transcript(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-ctx-'));
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
  assert.match(line, /\/fankeel → Adopt/);
  // Not yet the stronger wording: one compaction is a fact, not an emergency.
  assert.doesNotMatch(line, /Start a fresh session before the next one/);
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
