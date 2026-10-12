// What the band (hooks/pane-band.ts) and the Pane (hooks/pane-status.ts) both
// draw with: cell widths, the eighths bar, TokenBar's ramp as hex and the colour
// rule of each meter. No engine call and no import, so tests/pane-bar.test.js
// runs it under plain node. docs/90-agent/plans/2026-10-12-pane-band-design.md, section 2.

// The context tokens in play and the count hooks/compact.ts compacts at.
export type Context = { tokens: number; at: number }
// One window of the engine's session.usage().rateLimits.
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
// `mark` is the warning sign drawn after the number, or ''.
export type Paint = { color: string; bold: boolean; mark: string }

export const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/
// 💥 and 💀 are here. ⚠ (U+26A0) is not: it is counted one cell.
const EMOJI = /[\u{1F300}-\u{1FAFF}]/u

export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

// Terminal cells: a CJK, full-width or emoji character takes two.
export function width(s: string): number {
  let n = 0
  for (const ch of s) n += WIDE.test(ch) || EMOJI.test(ch) ? 2 : 1
  return n
}

// The head of `s` that fits `cols` cells, ending in an ellipsis when cut.
export function cut(s: string, cols: number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > cols - 1) break
    out += ch
  }
  return out + '…'
}

// xterm 240: labels, the bar's track and the separators.
export const DIM = '#585858'

// TokenBar's ramp (F:/ymlab/TokenBar/statusline.sh), each xterm number as its hex.
const XTERM: Record<number, string> = {
  46: '#00ff00', 83: '#5fff5f', 120: '#87ff87', 157: '#afffaf', 194: '#d7ffd7',
  193: '#d7ffaf', 192: '#d7ff87', 191: '#d7ff5f', 190: '#d7ff00', 226: '#ffff00',
  220: '#ffd700', 214: '#ffaf00', 208: '#ff8700', 202: '#ff5f00', 196: '#ff0000',
  197: '#ff005f', 198: '#ff0087', 199: '#ff00af', 200: '#ff00d7', 201: '#ff00ff',
}

// [from, xterm, bold]: the last step whose `from` is at or under the value wins.
type Step = [number, number, boolean?]
// Percent of the compact threshold: TokenBar's tier for a window of 500k or less.
const CTX: Step[] = [[0, 46], [8, 83], [16, 120], [24, 157], [32, 194], [36, 190], [40, 226], [45, 220], [50, 214], [55, 208],
  [60, 196, true], [65, 198, true], [70, 199, true], [75, 200, true], [80, 201, true]]
// Percent of the five-hour window used.
const FIVE: Step[] = [[0, 46], [10, 83], [20, 120], [30, 157], [40, 194], [45, 193], [50, 192], [55, 190], [60, 226], [65, 220], [70, 214], [75, 208],
  [80, 196, true], [85, 197, true], [90, 199, true], [95, 201, true]]
// The seven-day window's deviation from an even pace, in points.
const DEV: Step[] = [[-999, 46], [-10, 83], [-7, 120], [-3, 157], [0, 194], [1, 193], [2, 192], [3, 191], [4, 190], [5, 226], [6, 214], [7, 202],
  [8, 196], [9, 197], [10, 198], [11, 199], [12, 200], [13, 201], [14, 201, true]]

function step(steps: Step[], value: number): { color: string; bold: boolean } {
  let hit = steps[0]
  for (const s of steps) if (s[0] <= value) hit = s
  return { color: XTERM[hit[1]], bold: hit[2] === true }
}

export function ctxPaint(tokens: number, at: number): Paint {
  const percent = at > 0 ? (tokens * 100) / at : 0
  return { ...step(CTX, percent), mark: percent >= 80 ? '⚠' : '' }
}

export function fivePaint(used: number): Paint {
  return { ...step(FIVE, used), mark: used >= 95 ? '⚠' : '' }
}

const devMark = (dev: number): string => (dev >= 14 ? '💀' : dev >= 10 ? '💥' : dev >= 7 ? '⚠' : '')

// The deviation alone colours the seven-day meter, whatever was used; from 95
// percent used it is purple either way. With no deviation (no `resetsAt`) the
// colour is the five-hour rule on percent used, and there is no mark.
export function weekPaint(used: number, dev: number | null): Paint {
  if (dev === null) return { ...step(FIVE, used), mark: '' }
  if (used >= 95) return { color: XTERM[201], bold: true, mark: devMark(dev) }
  return { ...step(DEV, dev), mark: devMark(dev) }
}

const PART = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

// `cells` cells of bar: `fill` is the used part in eighths of a cell, rounded
// down, and `track` the rest. Either may be ''.
export function bar(part: number, whole: number, cells: number): { fill: string; track: string } {
  const eighths = whole > 0 ? Math.floor((Math.max(0, Math.min(part, whole)) * cells * 8) / whole) : 0
  const full = Math.floor(eighths / 8)
  const last = PART[eighths % 8]
  return { fill: '█'.repeat(full) + last, track: '░'.repeat(cells - full - (last ? 1 : 0)) }
}

// The instant the window resets, epoch milliseconds, or null.
export function resetMs(limit: Limit): number | null {
  const at = typeof limit.resetsAt === 'string' ? Date.parse(limit.resetsAt) : NaN
  return Number.isFinite(at) ? at : null
}

const WEEK = 7 * 24 * 3600 * 1000

// Percent used less the share of the seven days already gone by, in whole
// points, rounded half away from zero as TokenBar does. Null with no `resetsAt`.
export function deviation(limit: Limit, now: number): number | null {
  const reset = resetMs(limit)
  if (reset === null) return null
  const elapsed = Math.max(0, Math.min(1, 1 - (reset - now) / WEEK))
  const raw = limit.percentUsed - elapsed * 100
  // `|| 0`: never -0.
  return (raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5)) || 0
}

// `1h 46m`, or `2d 12h 30m` where `days` is asked for; `now` once it is past.
export function countdown(ms: number, days: boolean): string {
  if (!(ms > 0)) return 'now'
  const total = Math.floor(ms / 60000)
  const two = (n: number): string => String(n).padStart(2, '0')
  const hours = Math.floor(total / 60)
  if (days) return `${Math.floor(hours / 24)}d ${two(hours % 24)}h ${two(total % 60)}m`
  return `${hours}h ${two(total % 60)}m`
}

// Whole minutes in `ms`, never under zero: the band's stage minutes and the Pane's agent minutes are both this.
export const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60000))
// Whole seconds until `until`, a part second counted whole, never under zero: the band's badge and the Pane's gate row are both this.
export const secondsLeft = (until: number, now: number): number => Math.max(0, Math.ceil((until - now) / 1000))

// ` 66%`: three cells of number, so a column of them lines up.
export const pct = (n: number): string => `${String(Math.round(n)).padStart(3)}%`
export const kilo = (n: number): string => `${Math.round(n / 1000)}k`
export const signed = (dev: number): string => `${dev > 0 ? '+' : ''}${dev}%`

// The window of that kind (`five_hour`, `seven_day`), or null; one with no number is no window.
export function limitOf(limits: Limit[], kind: string): Limit | null {
  return limits.find((l) => !!l && l.kind === kind && typeof l.percentUsed === 'number' && Number.isFinite(l.percentUsed)) ?? null
}
