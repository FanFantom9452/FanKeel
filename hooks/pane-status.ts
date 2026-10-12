// The status half of the fankeel Pane: a registry entry and the engine's
// numbers in, rows out. No engine call here, so tests/pane-status.test.js runs
// it under plain node. What each block holds is
// docs/90-agent/plans/2026-10-12-pane-band-design.md section 3.

import { WHERE, FLAG, GUARD, TODO } from './pane-band.ts'
import { str, list, width, cut, WIDE, bar, ctxPaint, fivePaint, weekPaint, deviation, countdown, resetMs, limitOf, pct, kilo, signed, DIM } from './pane-bar.ts'
import type { Context, Limit, Paint } from './pane-bar.ts'

// Kept as exports of this file: hooks/pane-gate.ts and hooks/pane.ts import them from here.
export { str, list, width, cut, WIDE }
export type { Context }

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// `color` is a hex, or absent for the terminal's own. The segments of a row
// touch: one that wants a space before it carries the space in its text.
export type Seg = { text: string; color?: string; bold?: boolean }
// One drawn row. No segments is the blank row above a block. `who` is the
// neighbour a clash row names: hooks/pane.ts counts them against the band's flag.
export type Row = { block: string; segs: Seg[]; who?: string }
// A task of the plan: its number, its heading, and whether it is the user's to do.
export type PlanTask = { n: number; name: string; user: boolean }
// A plan's build ledger: its basename, the task numbers recorded complete, the tasks it has.
export type PlanInfo = { name: string; done: number[]; tasks: PlanTask[] }
export type StatusInput = {
  id: string
  entry: Entry | null
  others: Other[]
  context: Context | null
  limits: Limit[]
  plan: PlanInfo | null
  cols: number
  room: number
  now: number
  probe?: string | null
}

// Each block's rail, a fixed colour whatever the stage. The task block has
// none: its rail is the terminal's own colour. `gate` is drawn by hooks/pane.ts.
export const RAILS: Record<string, string> = {
  gate: '#d7af5f',
  clash: '#ff5f5f',
  tasks: '#87af5f',
  context: '#d787af',
  quota: '#8787d7',
  session: '#5fafaf',
  notes: '#87afd7',
  foot: '#585858',
}

const rail = (block: string): Seg => (Object.hasOwn(RAILS, block) ? { text: '▌', color: RAILS[block] } : { text: '▌' })
// A drawn row: the rail, then the segments that have text.
const row = (block: string, ...segs: Seg[]): Row => ({ block, segs: [rail(block), ...segs.filter((seg) => seg.text)] })
// A block's name, bold in its rail colour.
const title = (block: string, text: string): Seg => ({ text, color: RAILS[block], bold: true })
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
// Labels and secondary text.
const dim = (text: string): Seg => ({ text, color: WHERE })
const claimsOf = (entry: Entry): string[] => list(entry.claims ?? entry.scope)

// The tail of `s` that fits: a path is told apart by its end.
function tail(s: string, cols: number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of [...s].reverse()) {
    if (width(ch + out) > cols - 1) break
    out = ch + out
  }
  return '…' + out
}

// `s` whole, in rows of at most `cols` cells: a row that fills inside a word of
// narrow characters breaks at its last space, any other where it is full.
function wrap(s: string, cols: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const ch of s) {
    if (width(row + ch) <= cols) {
      row += ch
      continue
    }
    const at = row.lastIndexOf(' ')
    const word = row.slice(at + 1)
    if (ch !== ' ' && at > 0 && !WIDE.test(word + ch)) {
      rows.push(row.slice(0, at).trimEnd())
      row = word + ch
    } else {
      rows.push(row.trimEnd())
      row = ch === ' ' ? '' : ch
    }
  }
  if (row) rows.push(row)
  return rows
}

// Whole minutes, or `?` where the registry has no reading.
const mins = (ms: unknown): string => (typeof ms === 'number' && Number.isFinite(ms) ? String(Math.max(0, Math.floor(ms / 60000))) : '?')

// What hooks/compact.ts instructionsFor tells the summary to keep, a word each;
// tests/pane-status.test.js checks every word against that function's text.
export const KEPT = ['task', 'stage', 'plan', 'agent', 'handoff']

const LEDGER = '# fankeel build ledger — plan: '
// lib/ledger.js HEADER_PREFIX, owns and completed: the tasks the ledger records
// complete, ascending, or null when its first line names another plan.
export function ledgerDoneIds(text: string, claim: string): number[] | null {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== LEDGER + claim) return null
  const done = new Set<number>()
  for (const line of lines) {
    const m = /^Task (\d+): complete\b/.exec(line.trim())
    if (m) done.add(Number(m[1]))
  }
  return [...done].sort((a, b) => a - b)
}

export function ledgerDone(text: string, claim: string): number | null {
  const ids = ledgerDoneIds(text, claim)
  return ids === null ? null : ids.length
}

// lib/plantasks.js parsePlan: the `## Task N:` headings of a plan, a fenced one
// not counted, each with whether its first `**Dispatch:**` line names the user.
// Any other `## ` heading ends the tasks.
export function planTasks(text: string): PlanTask[] {
  const tasks: PlanTask[] = []
  let task: PlanTask | null = null
  let said = false
  let fence = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const t = fence ? null : /^##\s+Task\s+(\d+):\s*(.*)$/.exec(line)
    if (t) {
      task = { n: Number(t[1]), name: t[2].trim(), user: false }
      said = false
      tasks.push(task)
      continue
    }
    if (!fence && /^##\s/.test(line)) task = null
    const f = /^`{3,}/.exec(line)
    if (f) {
      if (fence === 0) fence = f[0].length
      else if (f[0].length >= fence) fence = 0
      continue
    }
    if (fence || !task || said) continue
    const d = /^\*\*Dispatch:\*\*\s*(.*)$/.exec(line)
    if (!d) continue
    said = true
    const word = /^([a-z][a-z-]*)/i.exec(d[1])
    task.user = !!word && word[1].toLowerCase() === 'user'
  }
  return tasks
}

export const planTotal = (text: string): number => planTasks(text).length

// `inner` is the cells a row has after its rail.
function taskBlock(entry: Entry, inner: number): Row[] {
  const rows = wrap(str(entry.task) || '—', inner).map((text) => row('task', { text, bold: true }))
  const next = str(entry.next)
  // 5: the cells of `next:`, which opens the first row.
  wrap(next ? `next: ${next}` : '', inner).forEach((text, i) => {
    rows.push(i ? row('task', { text }) : row('task', dim(text.slice(0, 5)), { text: text.slice(5) }))
  })
  return rows
}

// `12m`, `3h`, or '' where `updated` does not parse.
function ago(updated: unknown, now: number): string {
  const at = typeof updated === 'string' ? Date.parse(updated) : NaN
  if (!Number.isFinite(at)) return ''
  const m = Math.max(0, Math.floor((now - at) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`
}

// Each file this session holds that a neighbour holds too, then one row a
// neighbour holding it: its task, its stage, and how long since it moved.
function clashBlock(entry: Entry, others: Other[], inner: number, now: number): Row[] {
  const rows: Row[] = []
  for (const file of claimsOf(entry)) {
    const holders = others.filter((other) => claimsOf(other.entry).includes(file))
    if (!holders.length) continue
    // 2: the cells of `⚑ `, and of the indent under it.
    rows.push(row('clash', { text: `⚑ ${tail(file, Math.max(4, inner - 2))}`, color: FLAG, bold: true }))
    for (const other of holders) {
      const age = ago(other.entry.updated, now)
      const meta = ` @ ${str(other.entry.stage) || '?'}${age ? ` · ${age}` : ''}`
      const name = cut(str(other.entry.task) || other.id.slice(0, 8), Math.max(4, inner - 2 - width(meta)))
      rows.push({ ...row('clash', { text: `  ${name}` }, dim(meta)), who: other.id })
    }
  }
  return rows
}

// lib/guard.js's three modes, as what each does to a write into a neighbour's file.
const GUARDS: Record<string, string> = { deny: '直接擋下，不能改', ask: '先問你', off: '只提醒' }

function sessionBlock(entry: Entry): Row[] {
  const guard = Object.hasOwn(GUARDS, str(entry.guard)) ? str(entry.guard) : 'ask'
  return [
    row('session', title('session', '這個 session')),
    row('session', dim('別的 session 也在改同一個檔時')),
    row('session', { text: `  ${GUARDS[guard]}` }, dim(`  guard ${guard}`)),
    row('session', dim('這個任務改過的檔')),
    row('session', { text: `  ${claimsOf(entry).length} 個` }, dim('  claims')),
  ]
}

// A task complete, and an agent out on one.
const DONE = '#87af5f'
const OUT = '#af87d7'
// The minutes an agent is out before its row turns amber.
const LONG = 20
// A plan of more tasks than this folds into a window.
const WHOLE = 6

// The plan's tasks against its ledger. Six or fewer are listed; more fold to
// the count done, the first open task and the two after it, and how many are
// left — six rows at most. `inflight` is one mark, or a list of them once two
// agents are out (lib/registry.js inflights); the mod cannot tell which tasks a
// dispatch group holds, so the agent is drawn on the first open task that is
// not the user's. With no ledger, a mark on this stage is one row of its own.
function tasksBlock(entry: Entry, plan: PlanInfo | null, inner: number, now: number): Row[] {
  const stage = str(entry.stage)
  const marks = Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]
  const mark = marks.map(record).find((m) => m.stage === stage)
  const known = !!mark && typeof mark.at === 'number' && Number.isFinite(mark.at)
  const out = mark ? mins(known ? now - (mark.at as number) : null) : ''
  const late = known && Number(out) >= LONG
  if (!plan || !plan.tasks.length) {
    if (!mark) return []
    const group = Number.isInteger(mark.group) ? ` · 第 ${mark.group} 組` : ''
    const seg: Seg = { text: cut(`agent 出去 ${out} 分${group}`, inner) }
    if (late) seg.color = GUARD
    return [row('tasks', seg)]
  }
  const done = new Set(plan.done)
  const open = plan.tasks.filter((t) => !done.has(t.n))
  const count = plan.tasks.length - open.length
  const running = mark ? open.find((t) => !t.user) : undefined
  // Numbers right-aligned to the widest one.
  const pad = String(Math.max(...plan.tasks.map((t) => t.n))).length
  const one = (t: PlanTask): Row => {
    const label = ` ${String(t.n).padStart(pad)} `
    // 1: the mark every task row opens with.
    const name = (after: string): string => label + cut(t.name, Math.max(4, inner - 1 - width(label) - width(after)))
    if (done.has(t.n)) return row('tasks', { text: '●', color: DONE }, dim(name('')))
    if (t === running) {
      const after = ` · 出去 ${out} 分`
      return row('tasks', { text: '◉', color: OUT }, { text: name(after), bold: true }, { text: after, color: late ? GUARD : OUT })
    }
    if (t.user) return row('tasks', { text: '◐', color: GUARD }, { text: name(' · 你的') }, dim(' · 你的'))
    return row('tasks', { text: '○', color: TODO }, { text: name('') })
  }
  const head = row('tasks', title('tasks', 'tasks'), { text: ` ${count} of ${plan.tasks.length}` })
  if (plan.tasks.length <= WHOLE) return [head, ...plan.tasks.map(one)]
  const rows = [head]
  if (count) rows.push(row('tasks', { text: '✓', color: DONE }, dim(` 完成 ${count}`)))
  rows.push(...open.slice(0, 3).map(one))
  const rest = open.slice(3)
  if (rest.length) {
    const yours = rest.filter((t) => t.user).length
    rows.push(row('tasks', { text: '○', color: TODO }, dim(` 還有 ${rest.length} 個${yours ? `，${yours} 個是你的` : ''}`)))
  }
  return rows
}

const inked = (text: string, paint: Paint): Seg => (paint.bold ? { text, color: paint.color, bold: true } : { text, color: paint.color })
// The percent of the threshold the block says what a compact keeps at, and stops being dropped at.
const KEEP = 80
// Integer comparison, so a threshold needs no rounding.
const near = (context: Context): boolean => context.tokens * 100 >= KEEP * context.at

// The count and what is left before the automatic compact, then a bar on the
// scale 0 to the threshold (hooks/compact.ts HARD or FANKEEL_COMPACT_AT, never
// the model's window): ten to eighteen cells, as many as the label leaves.
function contextBlock(context: Context, inner: number): Row[] {
  const paint = ctxPaint(context.tokens, context.at)
  const hot = context.tokens >= context.at
  const label = hot ? ` 已到 ${kilo(context.at)}，compact 中` : ` 到 ${kilo(context.at)} 自動 compact`
  const { fill, track } = bar(context.tokens, context.at, Math.max(10, Math.min(18, inner - width(label))))
  const rows = [
    row('context', title('context', 'context'), inked(`  ${kilo(context.tokens)}`, paint), inked(paint.mark ? ` ${paint.mark}` : '', paint),
      dim(' · 還 '), { text: kilo(Math.max(0, context.at - context.tokens)) }, dim(' 可用')),
    row('context', inked(fill, paint), { text: track, color: DIM }, hot ? { text: label, color: GUARD, bold: true } : dim(label)),
  ]
  if (near(context)) rows.push(row('context', dim(cut(`留 ${KEPT.join(' · ')}`, inner))))
  return rows
}

// One row a window the engine gave: a ten-cell bar, percent used, what is left
// and when it resets. A row that does not fit drops the reset, then what is
// left. Under the seven-day row, its deviation from an even pace in a sentence.
function quotaBlock(limits: Limit[], inner: number, now: number): Row[] {
  const five = limitOf(limits, 'five_hour')
  const week = limitOf(limits, 'seven_day')
  if (!five && !week) return []
  const cells = (segs: Seg[]): number => segs.reduce((n, seg) => n + width(seg.text), 0)
  const meter = (label: string, limit: Limit, paint: Paint, mark: string, days: boolean): Row => {
    const { fill, track } = bar(limit.percentUsed, 100, 10)
    const reset = resetMs(limit)
    const base: Seg[] = [dim(label), inked(fill, paint), { text: track, color: DIM }, inked(` ${pct(limit.percentUsed)}`, paint), inked(mark ? ` ${mark}` : '', paint)]
    const left: Seg[] = [dim('  剩'), { text: pct(Math.max(0, Math.min(100, 100 - limit.percentUsed))) }]
    const until: Seg[] = reset === null ? [] : [dim(`  ↻ ${countdown(reset - now, days)}`)]
    const shape = [[...base, ...left, ...until], [...base, ...left]].find((segs) => cells(segs) <= inner) ?? base
    return row('quota', ...shape)
  }
  const rows = [row('quota', title('quota', '用量額度'))]
  if (five) {
    const paint = fivePaint(five.percentUsed)
    rows.push(meter('5h ', five, paint, paint.mark, false))
  }
  if (week) {
    const dev = deviation(week, now)
    const paint = weekPaint(week.percentUsed, dev)
    rows.push(meter('7d ', week, paint, '', true))
    if (dev !== null) {
      rows.push(row('quota', { text: '   ' }, inked(signed(dev), paint), inked(paint.mark ? ` ${paint.mark}` : '', paint),
        dim(`  ${dev > 0 ? '超前' : '落後'}平均進度`), { text: ` ${Math.abs(dev)} ` }, dim('點')))
    }
  }
  return rows
}

// A row cut to `cols` cells: the segment that crosses the edge is cut, and the ones after it go.
function fit(r: Row, cols: number): Row {
  let left = cols
  const segs: Seg[] = []
  for (const seg of r.segs) {
    if (left <= 0) break
    const w = width(seg.text)
    segs.push(w <= left ? seg : { ...seg, text: cut(seg.text, left) })
    left -= w
  }
  return { ...r, segs }
}

// Given up in this order when the rows do not fit: `tasks` keeps its title row,
// and `context` stays once it is at KEEP percent. The task, the gate
// (hooks/pane-gate.ts), the clash and the foot never go.
const DROP = ['session', 'notes', 'quota', 'tasks', 'context']

export function statusRows(input: StatusInput): Row[] {
  const { id, entry, others, cols, room, now } = input
  if (!entry) {
    return [
      { block: 'empty', segs: [{ text: cut('這個 session 沒有進行中的任務', cols) }] },
      { block: 'empty', segs: [dim(cut('/fankeel 開一個', cols))] },
    ]
  }
  // 1: the rail every drawn row opens with.
  const inner = Math.max(4, cols - 1)
  const blocks: Row[][] = [taskBlock(entry, inner)]
  const clash = clashBlock(entry, others, inner, now)
  if (clash.length) blocks.push(clash)
  const tasks = tasksBlock(entry, input.plan, inner, now)
  if (tasks.length) blocks.push(tasks)
  if (input.context) blocks.push(contextBlock(input.context, inner))
  const quota = quotaBlock(input.limits, inner, now)
  if (quota.length) blocks.push(quota)
  blocks.push(sessionBlock(entry))

  // The registry keeps the newest note last.
  const notes = list(entry.notes).slice(-3)
  if (notes.length) blocks.push([row('notes', title('notes', 'notes')), ...notes.map((note) => row('notes', { text: cut(`· ${note}`, inner) }))])

  // The probe is asked for by hand (hooks/pane.ts probeOf): it is drawn whole, in the block that never drops.
  const probed = input.probe ? wrap(input.probe, inner).map((text) => row('foot', dim(text))) : []
  blocks.push([...probed, row('foot', dim(cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, inner)))])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at < 0) continue
    if (name === 'tasks') blocks[at] = blocks[at].slice(0, 1)
    else if (name === 'context' && input.context && near(input.context)) continue
    else blocks.splice(at, 1)
  }
  return blocks.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block)).map((r) => fit(r, cols))
}
