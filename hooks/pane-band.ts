// The two rows above the prompt: which station this session is at, then how
// much is left of the context, the five-hour window and the seven-day one. An
// entry and the engine's numbers in, segments out; no engine call here, so
// tests/pane-band.test.js runs it under plain node.
// docs/90-agent/plans/2026-10-12-pane-band-design.md sections 1 and 2.

import { str, list, width, bar, markedBar, ctxPaint, ctxWindowPaint, fivePaint, weekPaint, deviation, elapsed, FIVE_HOURS, limitOf, pct, kilo, signed, minutes, secondsLeft, DIM } from './pane-bar.ts'
import type { Context, Limit, Paint } from './pane-bar.ts'

// `gap` is the cells of space before the segment; without one it sits against the last.
export type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean; gap?: number }
type Entry = Record<string, unknown>
// `gateUntil` is the `until` of the gate that is waiting, or null, and `gateAt` the
// `at` its pending file names, when the wait began: only the desktop's ring reads it.
// `tasks` is the plan's ledger count, or null.
export type BandInput = {
  entry: Entry | null
  others: { entry: Entry }[]
  gateUntil: number | null
  gateAt?: number | null
  context: Context | null
  limits: Limit[]
  tasks: { done: number; total: number } | null
  // Whether Remote Control is connected: Claude Code's session file has a bridgeSessionId.
  remote?: boolean
  cols: number
  now: number
}

// TokenBar's fankeel ramp (xterm 60 62 67 68 75 78 81), as hex.
export const RAMP: Record<string, string> = {
  survey: '#5f5f87',
  design: '#5f5fd7',
  plan: '#5f87af',
  build: '#5f87d7',
  verify: '#5fafff',
  audit: '#5fd787',
  land: '#5fd7ff',
}
// The stations still ahead, and a task not begun.
export const TODO = '#767676'
export const GUARD = '#d7af5f'
export const FLAG = '#ff5f5f'
export const WHERE = '#8a8a8a'
export const CLASH = '#ff0000'
export const INK = '#000000'
// The ✓ of 遠端: the green of a finished task in the Pane.
export const CONNECTED = '#87af5f'

// A stage off the ramp (init, or one a later version adds) is drawn as secondary text.
export const stageColor = (stage: string): string => (Object.hasOwn(RAMP, stage) ? RAMP[stage] : WHERE)

export const claimsOf = (entry: Entry): string[] => list(entry.claims ?? entry.scope)

// How many other sessions hold a file this one holds.
export function clashes(entry: Entry, others: { entry: Entry }[]): number {
  const mine = claimsOf(entry)
  return others.filter((other) => claimsOf(other.entry).some((file) => mine.includes(file))).length
}

// When this visit to `stage` began: the last move into it, else the stage's
// first clock mark. `clock` keeps one pair a stage, so a route-back reads
// there as one long visit.
export function since(entry: Entry, stage: string): number | null {
  const moves = Array.isArray(entry.moves) ? entry.moves : []
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i]
    if (Array.isArray(move) && move[0] === stage && typeof move[1] === 'number') return move[1]
  }
  const clock = (entry.clock && typeof entry.clock === 'object' ? entry.clock : {}) as Record<string, unknown>
  const pair = clock[stage]
  return Array.isArray(pair) && typeof pair[0] === 'number' ? pair[0] : null
}

function inked(text: string, paint: Paint, gap = 0): Seg {
  const seg: Seg = { text, color: paint.color }
  if (paint.bold) seg.bold = true
  if (gap) seg.gap = gap
  return seg
}

// One way of drawing the second row. They are tried in this order and the first
// that fits is drawn: the space round `│` closes up, then the bars shorten
// together, then the 7d meter goes, then the 5h one. No reset is drawn here at
// any width, and the Pane draws none either.
type Shape = { five: boolean; week: boolean; sp: number; cells: number }
function shapes(): Shape[] {
  const out: Shape[] = [{ five: true, week: true, sp: 2, cells: 10 }]
  for (const [five, week] of [[true, true], [true, false], [false, false]]) {
    for (let cells = 10; cells >= 5; cells--) out.push({ five, week, sp: 1, cells })
  }
  return out
}

export function bandRows(input: BandInput): Seg[][] | null {
  const { entry, others, gateUntil, context, limits, tasks, cols, now } = input
  if (!entry) return null
  const stage = str(entry.stage)
  const route = list(entry.route)
  const at = route.indexOf(stage)
  const flags = clashes(entry, others)
  const colour = stageColor(stage)
  const rail: Seg = { text: '▌', color: flags ? CLASH : colour }
  const used = (segs: Seg[]): number => segs.reduce((n, seg) => n + (seg.gap ?? 0) + width(seg.text), 0)

  const head: Seg[] = [rail, { text: `FANKEEL ${stage.toUpperCase()}`, color: colour, bold: true }]
  if (at >= 0) head.push({ text: '●'.repeat(at + 1), color: colour, gap: 2 })
  if (route.length - at - 1 > 0) {
    const ahead: Seg = { text: '○'.repeat(route.length - at - 1), color: TODO }
    if (at < 0) ahead.gap = 2
    head.push(ahead)
  }
  const count: Seg[] = tasks && tasks.total > 0
    ? [{ text: 'tasks', color: WHERE, gap: 2 }, { text: `${Math.max(0, Math.min(tasks.done, tasks.total))}/${tasks.total}`, gap: 1 }]
    : []
  const started = since(entry, stage)
  const here: Seg[] = started === null
    ? []
    : [{ text: '本站', color: WHERE, gap: 2 }, { text: String(minutes(now - started)), gap: 1 }, { text: '分', color: WHERE, gap: 1 }]
  const waits = (entry.waited && typeof entry.waited === 'object' ? entry.waited : {}) as Record<string, unknown>
  const wait = waits[stage]
  const waited = typeof wait === 'number' && Number.isFinite(wait) ? minutes(wait) : 0
  const gate: Seg[] = gateUntil === null
    ? []
    : [
        { text: ' gate 在等 ', backgroundColor: GUARD, color: INK, bold: true, gap: 2 },
        { text: `還 ${secondsLeft(gateUntil, now)} 秒`, color: GUARD, bold: true, gap: 2 },
      ]
  const yours: Seg[] = gateUntil === null
    ? [{ text: '等你', color: WHERE, gap: 2 }, { text: String(waited), gap: 1 }, { text: '分', color: WHERE, gap: 1 }]
    : [{ text: `等你 ${waited} 分`, color: GUARD, gap: 2 }]
  // Last on row one while it fits (the first group dropped): ✓ in green while Remote Control is connected, ✗ in the grey text colour when not (off is normal, not an alarm).
  const remote: Seg[] = [{ text: '遠端', color: WHERE, gap: 2 }, input.remote ? { text: '✓', color: CONNECTED, gap: 1 } : { text: '✗', color: WHERE, gap: 1 }]
  // `drop` is how many of the four droppable groups are gone: 遠端, then the stage minutes, then the wait, then tasks.
  const firstAt = (drop: number): Seg[] => {
    const a = drop < 4 ? count : []
    const b = drop < 3 ? yours : []
    const c = drop < 2 ? here : []
    const r = drop < 1 ? remote : []
    return gateUntil === null ? [...head, ...a, ...c, ...b, ...r] : [...head, ...a, ...gate, ...b, ...c, ...r]
  }
  let first = firstAt(0)
  for (let drop = 1; drop <= 4 && used(first) > cols; drop++) first = firstAt(drop)

  const five = limitOf(limits, 'five_hour')
  const week = limitOf(limits, 'seven_day')
  const secondAt = (shape: Shape): Seg[] => {
    const row: Seg[] = [rail]
    // A meter after the first is parted from it by `│`, with `sp` cells either side.
    const open = (label: string): void => {
      if (row.length === 1) {
        row.push({ text: label, color: DIM })
        return
      }
      row.push({ text: '│', color: DIM, gap: shape.sp }, { text: label, color: DIM, gap: shape.sp })
    }
    const draw = (part: number, whole: number, paint: Paint): void => {
      const { fill, track } = bar(part, whole, shape.cells)
      if (fill) row.push(inked(fill, paint))
      if (track) row.push({ text: track, color: DIM })
    }
    if (context) {
      const { window } = context
      const sized = typeof window === 'number' && Number.isFinite(window) && window > 0
      // With a window the colour and mark follow TokenBar's tiers by percent of that window; with none they follow the compact threshold. The white line is still the compact threshold.
      const paint = sized ? ctxWindowPaint(context.tokens, window) : ctxPaint(context.tokens, context.at)
      open('ctx ')
      if (sized) {
        // The white line sits at the compact threshold, when that is a point inside the window.
        if (context.at < window) {
          for (const p of markedBar(context.tokens, window, shape.cells, context.at)) {
            if (p.kind === 'fill') row.push(inked(p.text, paint))
            else row.push(p.kind === 'mark' ? { text: p.text, color: '#ffffff', bold: true } : { text: p.text, color: DIM })
          }
        } else {
          draw(context.tokens, window, paint)
        }
        row.push(inked(kilo(context.tokens), paint, 1), { text: `/${kilo(window)}`, color: WHERE })
      } else if (Number.isFinite(context.at)) {
        draw(context.tokens, context.at, paint)
        row.push(inked(kilo(context.tokens), paint, 1), { text: `/${kilo(context.at)}`, color: WHERE })
      } else {
        // No window, and compact.at off is an infinite threshold: the count alone, with nothing to measure it against.
        row.push(inked(kilo(context.tokens), paint))
      }
      if (paint.mark) row.push(inked(paint.mark, paint, 1))
    }
    if (five && shape.five) {
      const paint = fivePaint(five.percentUsed)
      open('5h ')
      // The even pace: a `│` at the share of the five hours gone by, as on the 7d meter of TokenBar.
      const gone = elapsed(five, now, FIVE_HOURS)
      if (gone === null) draw(five.percentUsed, 100, paint)
      else {
        for (const p of markedBar(five.percentUsed, 100, shape.cells, gone * 100)) {
          if (p.kind === 'fill') row.push(inked(p.text, paint))
          else row.push({ text: p.text, color: p.kind === 'mark' ? WHERE : DIM })
        }
      }
      row.push(inked(pct(five.percentUsed), paint, 1))
      if (paint.mark) row.push(inked(paint.mark, paint, 1))
    }
    if (week && shape.week) {
      const dev = deviation(week, now)
      const paint = weekPaint(week.percentUsed, dev)
      open('7d ')
      draw(week.percentUsed, 100, paint)
      row.push(inked(pct(week.percentUsed), paint, 1))
      if (dev !== null) {
        row.push(inked(signed(dev), paint, 2))
        if (paint.mark) row.push(inked(paint.mark, paint, 1))
      }
    }
    if (flags) row.push({ text: `⚑${flags}`, color: FLAG, bold: true, gap: 2 })
    return row
  }
  const tried = shapes().map(secondAt)
  const second = tried.find((row) => used(row) <= cols) ?? tried[tried.length - 1]
  // A second row with nothing but its rail is not drawn.
  return second.length > 1 ? [first, second] : [first]
}
