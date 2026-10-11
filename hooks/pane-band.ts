// The two rows above the prompt: this session's stage, guard and task, then
// what comes next or the gate that is waiting. An entry in, segments out; no
// engine call here, so tests/pane-band.test.js runs it under plain node.
// docs/90-agent/plans/2026-10-11-fankeel-pane-design.md section 6.

import { str, list, width, cut } from './pane-status.ts'

// `gap` is the cells of space before the segment; without one it sits against the last.
export type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean; gap?: number }
type Entry = Record<string, unknown>

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
export const HOLLOW = '#585858'
export const GUARD = '#d7af5f'
export const FLAG = '#ff5f5f'
export const TITLE = '#bcbcbc'
export const WHERE = '#8a8a8a'
export const CLASH = '#ff0000'
export const INK = '#000000'

// A stage off the ramp (init, or one a later version adds) is drawn as secondary text.
export const stageColor = (stage: string): string => (Object.hasOwn(RAMP, stage) ? RAMP[stage] : WHERE)

const claimsOf = (entry: Entry): string[] => list(entry.claims ?? entry.scope)

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

// `gate` is the first question of the gate that is waiting, or null.
export function bandRows(entry: Entry | null, others: { entry: Entry }[], gate: string | null, cols: number, now: number): Seg[][] | null {
  if (!entry) return null
  const stage = str(entry.stage)
  const route = list(entry.route)
  const at = route.indexOf(stage)
  const flags = clashes(entry, others)
  const colour = stageColor(stage)
  const rail = flags ? CLASH : colour
  const used = (segs: Seg[]): number => segs.reduce((n, seg) => n + (seg.gap ?? 0) + width(seg.text), 0)

  const first: Seg[] = [
    { text: '▌', color: rail },
    { text: `FANKEEL ${stage.toUpperCase()}`, color: colour, bold: true },
  ]
  if (at >= 0) first.push({ text: '●'.repeat(at + 1), color: colour, gap: 2 })
  if (route.length - at - 1 > 0) {
    const hollow: Seg = { text: '○'.repeat(route.length - at - 1), color: HOLLOW }
    if (at < 0) hollow.gap = 2
    first.push(hollow)
  }
  first.push({ text: `⚿ ${str(entry.guard) || 'ask'}`, color: GUARD, gap: 2 })
  if (flags) first.push({ text: `⚑${flags}`, color: FLAG, gap: 2 })
  first.push({ text: cut(str(entry.task), Math.max(4, cols - used(first) - 2)), color: TITLE, gap: 2 })

  const started = since(entry, stage)
  const where = [
    at >= 0 ? `${at + 1} of ${route.length}` : '',
    started === null ? '' : `${Math.max(0, Math.floor((now - started) / 60000))} 分`,
  ].filter(Boolean).join(' · ')
  const tail: Seg[] = [{ text: `${claimsOf(entry).length} 檔`, color: WHERE, gap: 2 }]
  if (where) tail.push({ text: where, color: WHERE, gap: 2 })
  const lead: Seg[] = [
    { text: '▌', color: rail },
    gate !== null ? { text: ' gate 在等 ', backgroundColor: GUARD, color: INK, bold: true } : { text: 'next', color: WHERE },
  ]
  const room = Math.max(4, cols - used(lead) - used(tail) - 2)
  const next = str(entry.next)
  const body: Seg = gate !== null
    ? { text: cut(gate, room), color: GUARD, gap: 2 }
    : { text: cut(next || '—', room), color: next ? TITLE : WHERE, gap: 2 }
  return [first, [...lead, body, ...tail]]
}
