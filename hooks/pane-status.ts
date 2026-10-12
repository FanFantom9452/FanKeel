// The status half of the fankeel Pane: a registry entry and the engine's
// numbers in, rows out. No engine call here, so tests/pane-status.test.js runs
// it under plain node. What each block holds is
// docs/90-agent/plans/2026-10-12-pane-band-design.md section 3.

import { WHERE, FLAG } from './pane-band.ts'
import { str, list, width, cut, WIDE } from './pane-bar.ts'
import type { Context, Limit } from './pane-bar.ts'

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

// Dropped in this order when the rows do not fit; the task, the gate (hooks/pane-gate.ts), the clash and the foot never are.
const DROP = ['session', 'notes']

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
    if (at >= 0) blocks.splice(at, 1)
  }
  return blocks.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block)).map((r) => fit(r, cols))
}
