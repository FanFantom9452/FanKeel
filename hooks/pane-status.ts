// The status half of the fankeel Pane: a registry entry in, rows out.
// No engine call here, so tests/pane-status.test.js runs it under plain node.
// What each block holds is docs/90-agent/judgements/2026-10-11-pane-right.md;
// the task block on top is the band's two rows (hooks/pane-band.ts) written out whole.

import { since } from './pane-band.ts'
import { str, list, width, cut, WIDE } from './pane-bar.ts'
import type { Context } from './pane-bar.ts'

// Kept as exports of this file: hooks/pane-band.ts, hooks/pane-gate.ts and hooks/pane.ts import them from here.
export { str, list, width, cut, WIDE }
export type { Context }

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// A colour by what it means; hooks/pane.ts turns each into a hex of hooks/pane-band.ts.
// `heat<N>` is the context count from N percent of the threshold: one of HEAT below.
export type Tone = 'head' | 'plain' | 'text' | 'dim' | 'amber' | 'clash' | 'hollow' | `heat${number}`
export type Seg = { text: string; tone: Tone; bold?: boolean }
// One drawn row, its segments a cell apart. No segments is the blank row above a block.
export type Row = { block: string; segs: Seg[] }
// A plan's build ledger: its basename, the tasks recorded complete, the tasks it has.
export type PlanCount = { name: string; done: number; total: number }

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

// lib/ledger.js HEADER_PREFIX, owns and completed: how many tasks the ledger
// records complete, or null when its first line names another plan.
const LEDGER = '# fankeel build ledger — plan: '
export function ledgerDone(text: string, claim: string): number | null {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== LEDGER + claim) return null
  const done = new Set<number>()
  for (const line of lines) {
    const m = /^Task (\d+): complete\b/.exec(line.trim())
    if (m) done.add(Number(m[1]))
  }
  return done.size
}

// lib/plantasks.js parsePlan: the `## Task N:` headings of a plan, a fenced one not counted.
export function planTotal(text: string): number {
  let total = 0
  let fence = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const f = /^`{3,}/.exec(line)
    if (f) {
      if (fence === 0) fence = f[0].length
      else if (f[0].length >= fence) fence = 0
      continue
    }
    if (!fence && /^##\s+Task\s+\d+:/.test(line)) total += 1
  }
  return total
}

// Dropped in this order when the rows do not fit; the task, the gate (hooks/pane-gate.ts), the shared files and the foot never are.
const DROP = ['notes', 'plan', 'agent', 'context']

// TokenBar's context ramp, second tier: the percent of the threshold each colour starts at.
const HEAT = [36, 40, 45, 50, 55, 60, 65, 70, 75]
// The percent the count turns bold at, and the one the block says what a compact keeps at.
const BOLD = 60
const KEEP = 80
// The minutes an agent is out before its row turns amber.
const LONG = 20

const thousands = (n: number): string => `${Math.round(n / 1000)}k`

export function statusRows(
  id: string,
  entry: Entry | null,
  others: Other[],
  context: Context | null,
  plan: PlanCount | null,
  cols: number,
  room: number,
  now: number,
  probe: string | null = null,
): Row[] {
  const one = (block: string, text: string, tone: Tone): Row => ({ block, segs: [{ text, tone }] })
  if (!entry) {
    return [one('empty', cut('這個 session 沒有進行中的任務', cols), 'plain'), one('empty', cut('/fankeel 開一個', cols), 'dim')]
  }
  const head = (block: string, text: string): Row => ({ block, segs: [{ text: cut(text, cols), tone: 'head', bold: true }] })
  const claims = list(entry.claims ?? entry.scope)
  const stage = str(entry.stage)
  const route = list(entry.route)
  const at = route.indexOf(stage)
  const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  const waited = record(entry.waited)
  const blocks: Row[][] = []

  const spent = (label: string, name: string, ms: number | null): Row =>
    one('task', cut(`${label} ${name} ${mins(ms)} 分 · 等你 ${mins(waited[name] ?? 0)} 分`, cols), 'dim')
  const task: Row[] = wrap(str(entry.task), cols).map((text) => ({ block: 'task', segs: [{ text, tone: 'plain', bold: true }] }))
  if (route.length) {
    const stations = route.map((name) => (name === stage ? `[${name}]` : name)).join(' ▸ ')
    task.push(...wrap(stations, cols).map((text) => one('task', text, 'text')))
  }
  const next = str(entry.next)
  if (next) task.push(...wrap(`next: ${next}`, cols).map((text) => one('task', text, 'text')))
  const started = since(entry, stage)
  task.push(spent('本站', stage, started === null ? null : now - started))
  if (at > 0) {
    const pair = record(entry.clock)[route[at - 1]]
    const ran = Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number' ? pair[1] - pair[0] : null
    task.push(spent('上站', route[at - 1], ran))
  }
  blocks.push(task)

  const shared = claims.filter((file) => others.some((other) => list(other.entry.claims ?? other.entry.scope).includes(file)))
  // 2: the cells of `⚑ `.
  if (shared.length) {
    blocks.push(shared.map((file): Row => ({ block: 'neighbours', segs: [{ text: `⚑ ${tail(file, Math.max(4, cols - 2))}`, tone: 'clash', bold: true }] })))
  }

  // `inflight` is one mark, or a list of them once two agents are out (lib/registry.js inflights).
  const marks = Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]
  const mark = marks.map(record).find((m) => m.stage === stage)
  if (mark) {
    const known = typeof mark.at === 'number' && Number.isFinite(mark.at)
    const out = mins(known ? now - (mark.at as number) : null)
    const group = Number.isInteger(mark.group) ? ` · 第 ${mark.group} 組` : ''
    blocks.push([one('agent', cut(`agent 出去 ${out} 分${group}`, cols), known && Number(out) >= LONG ? 'amber' : 'text')])
  }

  if (context) {
    const count = thousands(context.tokens)
    const rest = cut(`· 到 ${thousands(context.at)} 自動 compact`, Math.max(4, cols - width(count) - 1))
    const hot = context.tokens >= context.at
    // Integer comparison, so a threshold needs no rounding.
    const reached = (percent: number): boolean => context.tokens * 100 >= percent * context.at
    const step = HEAT.filter(reached).pop()
    const first: Seg = { text: count, tone: step ? `heat${step}` : 'plain' }
    if (reached(BOLD)) first.bold = true
    const rows: Row[] = [
      head('context', 'context'),
      { block: 'context', segs: [first, hot ? { text: rest, tone: 'amber', bold: true } : { text: rest, tone: 'dim' }] },
    ]
    if (reached(KEEP)) rows.push(one('context', cut(`留 ${KEPT.join(' · ')}`, cols), 'dim'))
    blocks.push(rows)
  }

  if (plan && plan.total > 0) {
    const done = Math.max(0, Math.min(plan.done, plan.total))
    const count = `tasks ${done} of ${plan.total}`
    const segs: Seg[] = []
    // One dot a task, while the row has the cells for them.
    if (plan.total + 2 + width(count) <= cols) {
      if (done) segs.push({ text: '●'.repeat(done), tone: 'head' })
      if (plan.total - done) segs.push({ text: '○'.repeat(plan.total - done), tone: 'hollow' })
    }
    segs.push({ text: cut(count, cols), tone: 'plain' })
    blocks.push([head('plan', 'plan'), { block: 'plan', segs }, one('plan', cut(plan.name, cols), 'dim')])
  }

  // The registry keeps the newest note last.
  const notes = list(entry.notes).slice(-3)
  if (notes.length) blocks.push([head('notes', 'notes'), ...notes.map((note) => one('notes', cut(`· ${note}`, cols), 'text'))])

  // The probe is asked for by hand (hooks/pane.ts probeOf): it is drawn whole, in the block that never drops.
  const probed = probe ? wrap(probe, cols).map((text) => one('foot', text, 'dim')) : []
  blocks.push([...probed, one('foot', cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, cols), 'dim')])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at >= 0) blocks.splice(at, 1)
  }
  return blocks.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block))
}
