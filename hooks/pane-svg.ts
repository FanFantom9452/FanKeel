// The desktop drawings of the band and the Pane: the data hooks/pane-band.ts
// and hooks/pane-status.ts turn into rows, turned into `<svg>` strings for the
// engine's Svg element. No engine call here, so tests/pane-svg.test.js runs it
// under plain node. docs/90-agent/plans/2026-10-14-pane-svg-design.md is the
// design; the approved drawing is the mockup .fankeel/build/2026-10-14-pane-svg/gen.mjs wrote.

import { TODO, GUARD, CONNECTED, FLAG, WHERE, CLASH, INK, stageColor, since, clashes, claimsOf } from './pane-band.ts'
import type { BandInput } from './pane-band.ts'
import { str, list, kilo, cut, ctxPaint, ctxWindowPaint, fivePaint, weekPaint, deviation, elapsed, FIVE_HOURS, limitOf, signed, minutes, secondsLeft, DIM } from './pane-bar.ts'
import { ago, DONE } from './pane-status.ts'
import type { Entry, Other, Row, StatusInput } from './pane-status.ts'
import { say } from './pane-lang.ts'
import type { Lang } from './pane-lang.ts'

// The engine's bound on SvgProps.source, in characters.
export const SVG_MAX = 131072
// One terminal cell in CSS pixels: the Pane's 41 cells are 328px, the band's 80 are 640px.
const CELL_PX = 8
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
// The characters a 12px monospace face draws a full em wide: hooks/pane-bar.ts WIDE, and ⚑.
const WIDE_PX = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦⚑]/

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// The drawn width of `s` at `size` px: a wide character is one em, any other three fifths of one.
const px = (s: string, size = 12): number => [...s].reduce((n, ch) => n + (WIDE_PX.test(ch) ? size : size * 0.6), 0)
const r1 = (n: number): number => Math.round(n * 10) / 10
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

// The head of `s` that fits `room` px, ending in an ellipsis when cut.
function fitPx(s: string, room: number): string {
  if (px(s) <= room) return s
  let out = ''
  for (const ch of s) {
    if (px(out + ch + '…') > room) break
    out += ch
  }
  return out + '…'
}

// The tail of `s` that fits: a path is told apart by its end.
function tailPx(s: string, room: number): string {
  if (px(s) <= room) return s
  let out = ''
  for (const ch of [...s].reverse()) {
    if (px('…' + ch + out) > room) break
    out = ch + out
  }
  return '…' + out
}

function svgDoc(w: number, h: number, body: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r1(w)}" height="${r1(h)}" viewBox="0 0 ${r1(w)} ${r1(h)}" font-family="${FONT}" font-size="12"${extra}>${body}</svg>`
}

// Text is grey unless `fill` says otherwise: the Svg is drawn as an image and cannot see the theme.
function text(x: number, y: number, s: string, o: { fill?: string; bold?: boolean; anchor?: string } = {}): string {
  const a = [`x="${r1(x)}"`, `y="${r1(y)}"`, `fill="${o.fill ?? WHERE}"`]
  if (o.bold) a.push('font-weight="700"')
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`)
  return `<text ${a.join(' ')}>${esc(s)}</text>`
}

// What an Svg says to a reader that cannot see it: the rows it stands for as the
// terminal draws them, without the rail each row opens with, one line a row.
export function altOf(rows: { text: string; gap?: number }[][]): string {
  return rows.map((segs) => segs.slice(1).map((seg) => ' '.repeat(seg.gap ?? 0) + seg.text).join('')).join('\n')
}

// The band's rows are this tall, and a row's text sits on y 15.
const BAND_H = 22

// The band's first row: the badge, the route as dots (done filled in its
// station's colour, here one hollow ring in it, ahead hollow grey), the tasks as small
// cells, the gate's countdown ring, the wait and the stage minutes.
export function bandRow1Svg(input: BandInput): string {
  const { entry, others, gateUntil, tasks, cols, now } = input
  if (!entry) return ''
  const gateAt = input.gateAt ?? null
  const stage = str(entry.stage)
  const route = list(entry.route)
  const at = route.indexOf(stage)
  const colour = stageColor(stage)
  let b = `<rect x="0" y="2" width="3" height="18" fill="${clashes(entry, others) ? CLASH : colour}"/>`
  let x = 10
  const head = `FANKEEL ${stage.toUpperCase()}`
  b += text(x, 15, head, { fill: colour, bold: true })
  x += px(head) + 6
  if (route.length) {
    const step = 14
    const x0 = x + 6
    const rad = (i: number): number => (i === at ? 5.75 : 4)
    for (let i = 0; i < route.length - 1; i++) {
      const a = x0 + step * i + rad(i) + 1
      const z = x0 + step * (i + 1) - rad(i + 1) - 1
      b += `<line x1="${r1(a)}" y1="11" x2="${r1(z)}" y2="11" stroke="${i < at ? WHERE : TODO}" stroke-width="${i < at ? 1.5 : 1}"/>`
    }
    route.forEach((name, i) => {
      const c = stageColor(name)
      const cx = r1(x0 + step * i)
      if (i < at) b += `<circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>`
      else if (i === at) b += `<circle cx="${cx}" cy="11" r="5" fill="none" stroke="${c}" stroke-width="2"/>`
      else b += `<circle cx="${cx}" cy="11" r="3.25" fill="none" stroke="${TODO}" stroke-width="1.5"/>`
    })
    x = x0 + step * (route.length - 1) + 7 + 12
  }
  // The row's words in the machine's ui.lang (hooks/pane-lang.ts), apart so they are written once.
  const lang = input.lang
  const word = {
    gate: say(lang, 'svg.gate'),
    secs: (n: number): string => say(lang, 'svg.secs', { n }),
    here: say(lang, 'band.here'),
    you: say(lang, 'band.you'),
    min: say(lang, 'band.min'),
    remote: say(lang, 'band.remote'),
  }
  // What follows the route, each drawn at x: `w` px of its own, then `gap` px before the next.
  type Group = { name: string; w: number; gap: number; draw: (x: number) => string }
  const full = cols * CELL_PX
  let count: Group | null = null
  if (tasks && tasks.total > 0) {
    const total = tasks.total
    const done = Math.max(0, Math.min(tasks.done, total))
    const n = `${done}/${total}`
    // Six px a cell while a cell a task still reads; past ten, one bar on the 5h meter's track, so the band stops growing with the plan.
    const cells = total <= 10 ? total * 6 + 4 : WELL + 6
    count = {
      name: 'tasks',
      w: px('tasks') + 6 + cells + px(n),
      gap: 12,
      draw: (x0) => {
        const x = x0 + px('tasks') + 6
        let s = text(x0, 15, 'tasks')
        if (total <= 10) {
          for (let i = 0; i < total; i++) s += `<rect x="${r1(x + i * 6)}" y="7" width="4" height="8" rx="1" fill="${i < done ? DONE : DIM}"/>`
        } else s += well(x, done / total, DONE)
        return s + text(x + cells, 15, n, { bold: true })
      },
    }
  }
  const waits = record(entry.waited)
  const wait = waits[stage]
  const waited = typeof wait === 'number' && Number.isFinite(wait) ? minutes(wait) : 0
  const started = since(entry, stage)
  const here = started === null ? null : minutes(now - started)
  const hereText = `${word.here} ${here} ${word.min}`
  const youText = `${word.you} ${waited} ${word.min}`
  let gate: Group | null = null
  if (gateUntil !== null) {
    const badge = px(word.gate) + 12
    // The ring is full at the gate's whole wait (gate.station), from `at` to `until`.
    const left = secondsLeft(gateUntil, now)
    const whole = gateAt !== null && gateUntil > gateAt ? (gateUntil - gateAt) / 1000 : left
    const share = whole > 0 ? Math.min(1, left / whole) : 0
    const r = 6.5
    const c = 2 * Math.PI * r
    const secs = word.secs(left)
    gate = {
      name: 'gate',
      w: badge + 10 + 11 + px(secs),
      gap: 12,
      draw: (x0) => {
        const x = x0 + badge + 10
        return `<rect x="${r1(x0)}" y="2" width="${r1(badge)}" height="18" rx="3" fill="${GUARD}"/>`
          + text(x0 + 6, 15, word.gate, { fill: INK, bold: true })
          + `<circle cx="${r1(x)}" cy="11" r="${r}" fill="none" stroke="${DIM}" stroke-width="2.5"/>`
          + `<circle cx="${r1(x)}" cy="11" r="${r}" fill="none" stroke="${GUARD}" stroke-width="2.5" stroke-dasharray="${r1(c * share)} ${r1(c)}" transform="rotate(-90 ${r1(x)} 11)"/>`
          + text(x + 11, 15, secs, { fill: GUARD, bold: true })
      },
    }
  }
  const stay: Group | null = here === null ? null : {
    name: 'here',
    w: px(hereText),
    gap: gate ? 12 : 14,
    draw: (x) => text(x, 15, word.here) + text(x + px(`${word.here} `), 15, String(here), { bold: true }) + text(x + px(`${word.here} ${here} `), 15, word.min),
  }
  const you: Group = {
    name: 'wait',
    w: px(youText),
    gap: 12,
    draw: (x) => (gate
      ? text(x, 15, youText, { fill: GUARD })
      : text(x, 15, word.you) + text(x + px(`${word.you} `), 15, String(waited), { bold: true }) + text(x + px(`${word.you} ${waited} `), 15, word.min)),
  }
  const mark = input.remote ? '✓' : '✗'
  const remote: Group = {
    name: 'remote',
    w: px(`${word.remote} ${mark}`),
    gap: 0,
    draw: (x) => text(x, 15, word.remote) + text(x + px(`${word.remote} `), 15, mark, input.remote ? { fill: CONNECTED } : {}),
  }
  // The order bandRows lays row one out in, and the order it gives groups up
  // in (it drops the model first, which this row does not draw): 遠端, the
  // stage minutes, the wait, tasks. The gate's badge never goes.
  let kept = (gate ? [count, gate, you, stay, remote] : [count, stay, you, remote]).filter((g): g is Group => g !== null)
  const end = (list: Group[]): number => list.reduce((n, g) => n + g.w + g.gap, x) - (list.length ? list[list.length - 1].gap : 0)
  for (const name of ['remote', 'here', 'wait', 'tasks']) {
    if (end(kept) <= full) break
    kept = kept.filter((g) => g.name !== name)
  }
  for (const g of kept) {
    b += g.draw(x)
    x += g.w + g.gap
  }
  return svgDoc(full, BAND_H, b)
}

// A meter: a DIM well, the used part in its paint, then any marks over it.
const WELL = 96
function well(x0: number, share: number, color: string, marks = ''): string {
  let s = `<rect x="${r1(x0)}" y="6" width="${WELL}" height="10" rx="2" fill="${DIM}"/>`
  const fw = Math.max(0, Math.min(1, share)) * (WELL - 2)
  if (fw > 0) s += `<rect x="${r1(x0 + 1)}" y="7" width="${r1(fw)}" height="8" rx="1.5" fill="${color}"/>`
  return s + marks
}

// The band's second row: ctx, 5h and 7d as meters parted by a grey rule, then ⚑N.
// The same choices as hooks/pane-band.ts bandRows: ctx is measured against the
// window where the engine reports one, with a grey line at the compact point
// inside it, else against the threshold; with neither, the count alone. ''
// where the row has nothing to draw.
export function bandRow2Svg(input: BandInput): string {
  const { entry, others, context, limits, now, cols } = input
  if (!entry) return ''
  const flags = clashes(entry, others)
  const rail = `<rect x="0" y="2" width="3" height="18" fill="${flags ? CLASH : stageColor(str(entry.stage))}"/>`
  // One pass over the row. `flagFirst` puts ⚑N right after the rail instead of last.
  const layout = (flagFirst: boolean): { b: string; x: number; drawn: number } => {
    let b = rail
    let x = 10
    let drawn = 0
    const open = (label: string): void => {
      if (drawn++) {
        x += 14
        b += `<line x1="${r1(x)}" y1="4" x2="${r1(x)}" y2="18" stroke="${DIM}" stroke-width="1"/>`
        x += 10
      }
      b += text(x, 15, label)
      x += px(label) + 6
    }
    const after = (s: string, o: { fill?: string; bold?: boolean } = {}, gap = 0): void => {
      b += text(x + gap, 15, s, o)
      x += gap + px(s)
    }
    if (flags && flagFirst) {
      after(`⚑${flags}`, { fill: FLAG, bold: true })
      drawn++
    }
    if (context) {
      const window = context.window
      const sized = typeof window === 'number' && Number.isFinite(window) && window > 0
      const finite = Number.isFinite(context.at)
      const paint = sized ? ctxWindowPaint(context.tokens, window as number) : ctxPaint(context.tokens, context.at)
      const whole = sized ? (window as number) : finite ? context.at : 0
      open('ctx')
      if (whole > 0) {
        const mark = sized && finite && context.at < whole
          ? `<rect x="${r1(x + 1 + (context.at / whole) * (WELL - 2) - 1)}" y="2" width="2" height="18" rx="1" fill="${WHERE}"/>`
          : ''
        b += well(x, context.tokens / whole, paint.color, mark)
        x += WELL + 6
      }
      after(kilo(context.tokens), { bold: true })
      if (whole > 0) after(`/${kilo(whole)}`)
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    const five = limitOf(limits, 'five_hour')
    if (five) {
      const paint = fivePaint(five.percentUsed)
      open('5h')
      // The even pace: the share of the five hours gone by, the same thin grey tick as 7d.
      const gone = elapsed(five, now, FIVE_HOURS)
      const pace = gone === null ? '' : `<rect x="${r1(x + 1 + gone * (WELL - 2) - 0.75)}" y="3" width="1.5" height="16" fill="${WHERE}"/>`
      b += well(x, five.percentUsed / 100, paint.color, pace)
      x += WELL + 6
      after(`${Math.round(five.percentUsed)}%`, { bold: true })
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    const week = limitOf(limits, 'seven_day')
    if (week) {
      const dev = deviation(week, now)
      const paint = weekPaint(week.percentUsed, dev)
      open('7d')
      // The even pace: the share of the seven days gone by, a thin grey tick.
      const pace = dev === null
        ? ''
        : `<rect x="${r1(x + 1 + (Math.max(0, Math.min(100, week.percentUsed - dev)) / 100) * (WELL - 2) - 0.75)}" y="3" width="1.5" height="16" fill="${WHERE}"/>`
      b += well(x, week.percentUsed / 100, paint.color, pace)
      x += WELL + 6
      after(`${Math.round(week.percentUsed)}%`, { bold: true })
      if (dev !== null) after(signed(dev), {}, 6)
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    if (flags && !flagFirst) after(`⚑${flags}`, { fill: FLAG, bold: true }, drawn ? 14 : 0)
    return { b, x, drawn }
  }
  // Last first. Only when the row as drawn ends past the Svg's width, and there
  // is something for the flag to move ahead of, does it go to the front.
  let row = layout(false)
  if (flags && row.drawn && row.x > cols * CELL_PX) row = layout(true)
  return row.drawn || flags ? svgDoc(cols * CELL_PX, BAND_H, row.b) : ''
}

// The Pane's width in px: one cell is CELL_PX.
const paneW = (cols: number): number => cols * CELL_PX

type Station = { name: string; state: 'done' | 'here' | 'ahead'; min: number | null; wait: number }

// The route under the task title: a column a station, its dot (done green, here
// one hollow ring in its station's colour, ahead hollow grey), a bar of the minutes it took from the entry's
// `clock` against the longest, and the minutes its gate waited (`waited`) in
// amber at the bar's end. '' when the stage is not on the route.
export function routeSvg(entry: Entry, now: number, cols: number, lang?: Lang): string {
  const route = list(entry.route)
  const at = route.indexOf(str(entry.stage))
  if (at < 0) return ''
  const W = paneW(cols)
  const clock = record(entry.clock)
  const waits = record(entry.waited)
  const stations: Station[] = route.map((name, i): Station => {
    if (i > at) return { name, state: 'ahead', min: null, wait: 0 }
    const pair = clock[name]
    const from = Array.isArray(pair) && typeof pair[0] === 'number' ? pair[0] : null
    const to = i === at ? now : Array.isArray(pair) && typeof pair[1] === 'number' ? pair[1] : null
    const wait = waits[name]
    return {
      name,
      state: i < at ? 'done' : 'here',
      min: from !== null && to !== null ? minutes(to - from) : null,
      wait: typeof wait === 'number' && Number.isFinite(wait) ? minutes(wait) : 0,
    }
  })
  const n = stations.length
  const slot = W / n
  const cx = (i: number): number => slot * i + slot / 2
  const max = Math.max(1, ...stations.map((s) => s.min ?? 0))
  let b = ''
  stations.forEach((s, i) => {
    b += text(cx(i), 12, fitPx(s.name, slot - 2), { anchor: 'middle', bold: s.state === 'here', fill: s.state === 'ahead' ? TODO : WHERE })
  })
  b += `<line x1="${r1(cx(0))}" y1="26" x2="${r1(cx(at))}" y2="26" stroke="${DONE}" stroke-width="2"/>`
  b += `<line x1="${r1(cx(at))}" y1="26" x2="${r1(cx(n - 1))}" y2="26" stroke="${TODO}" stroke-width="1"/>`
  stations.forEach((s, i) => {
    const x = r1(cx(i))
    if (s.state === 'done') b += `<circle cx="${x}" cy="26" r="4" fill="${DONE}"/>`
    else if (s.state === 'here') b += `<circle cx="${x}" cy="26" r="6" fill="none" stroke="${stageColor(s.name)}" stroke-width="2.5"/>`
    else b += `<circle cx="${x}" cy="26" r="3.75" fill="none" stroke="${TODO}" stroke-width="1.5"/>`
  })
  const full = slot - 10
  stations.forEach((s, i) => {
    if (s.min === null) return
    const w = Math.max(3, (s.min / max) * full)
    const ww = s.wait ? Math.min(w, Math.max(2, (s.wait / max) * full)) : 0
    const x0 = cx(i) - w / 2
    if (w - ww > 0) b += `<rect x="${r1(x0)}" y="38" width="${r1(w - ww)}" height="4" rx="1" fill="${s.state === 'done' ? DONE : WHERE}"/>`
    if (ww) b += `<rect x="${r1(x0 + w - ww)}" y="38" width="${r1(ww)}" height="4" rx="1" fill="${GUARD}"/>`
    b += text(cx(i), 56, say(lang, 'route.min', { n: s.min }), { anchor: 'middle', bold: s.state === 'here' })
    if (s.wait) b += text(cx(i), 72, say(lang, 'route.wait', { n: s.wait }), { anchor: 'middle', fill: GUARD })
  })
  return svgDoc(W, 78, b)
}

// The clash as a small graph: the files this session shares on the left, the
// sessions holding them on the right, a red line for each hold; under each
// session its station's colour, its stage and how long since it moved. ''
// where no file is shared.
export function clashSvg(entry: Entry, others: Other[], now: number, cols: number): string {
  const files = claimsOf(entry).filter((file) => others.some((other) => claimsOf(other.entry).includes(file)))
  if (!files.length) return ''
  const holders = others.filter((other) => claimsOf(other.entry).some((file) => files.includes(file)))
  const W = paneW(cols)
  const fileY = (i: number): number => 16 + i * 26
  const whoY = (j: number): number => 14 + j * 40
  const h = Math.max(fileY(files.length - 1) + 14, whoY(holders.length - 1) + 30)
  // 10, 174 and 218 of the mockup's 328px.
  const L = 10
  const LW = Math.round(W * 0.53)
  const RX = L + LW + 34
  let b = `<rect x="0" y="0" width="3" height="${h}" fill="${FLAG}"/>`
  files.forEach((file, i) => {
    b += text(L, fileY(i), '⚑', { fill: FLAG, bold: true })
    b += text(L + 16, fileY(i), tailPx(file, LW - 16), { fill: FLAG, bold: true })
    holders.forEach((other, j) => {
      if (!claimsOf(other.entry).includes(file)) return
      const y1 = fileY(i) - 4
      const y2 = whoY(j) - 4
      b += `<path d="M ${L + LW + 4} ${y1} C ${L + LW + 22} ${y1}, ${RX - 20} ${y2}, ${RX - 6} ${y2}" fill="none" stroke="${FLAG}" stroke-width="1.5"/>`
    })
    b += `<circle cx="${L + LW + 4}" cy="${fileY(i) - 4}" r="2.5" fill="${FLAG}"/>`
  })
  holders.forEach((other, j) => {
    const stage = str(other.entry.stage) || '?'
    const age = ago(other.entry.updated, now)
    b += `<circle cx="${RX - 6}" cy="${whoY(j) - 4}" r="2.5" fill="${FLAG}"/>`
    b += text(RX, whoY(j), fitPx(str(other.entry.task) || other.id.slice(0, 8), W - RX - 2), { bold: true })
    b += `<circle cx="${RX + 4}" cy="${whoY(j) + 13}" r="3.5" fill="${stageColor(stage)}"/>`
    b += text(RX + 12, whoY(j) + 17, age ? `${stage} · ${age}` : stage)
  })
  return svgDoc(W, h, b)
}

// One piece of the desktop Pane, top to bottom: rows drawn as Text, as the
// terminal draws them, or one Svg.
export type Part = { rows: Row[] } | { source: string; alt: string; isInteractive?: boolean }

// The desktop Pane from the rows statusRows drew for the same input: the task
// title, `next:`, the tasks, the agents, notes and the foot stay rows; the route
// rows and the clash become one Svg each, whose alt is those rows' text. A
// drawing with nothing in it, or one over SVG_MAX, stays rows.
export function paneParts(input: StatusInput, rows: Row[]): Part[] {
  const parts: Part[] = []
  const keep = (rs: Row[]): void => {
    if (!rs.length) return
    const last = parts[parts.length - 1]
    if (last && 'rows' in last) last.rows.push(...rs)
    else parts.push({ rows: [...rs] })
  }
  const draw = (source: string, rs: Row[], isInteractive: boolean): void => {
    if (!source || source.length > SVG_MAX || !rs.length) return keep(rs)
    const alt = altOf(rs.map((r) => r.segs))
    parts.push(isInteractive ? { source, alt, isInteractive } : { source, alt })
  }
  // A block opens with the blank row above it, but for the first.
  const blocks: Row[][] = []
  for (const r of rows) {
    if (!r.segs.length || !blocks.length) blocks.push([r])
    else blocks[blocks.length - 1].push(r)
  }
  const { entry, now, cols } = input
  for (const block of blocks) {
    const lead = block[0].segs.length ? [] : [block[0]]
    const body = block.slice(lead.length)
    keep(lead)
    const name = body.length ? body[0].block : ''
    if (!entry) keep(body)
    else if (name === 'task') {
      // The route rows end the block: each holds only station names and ` › `.
      const route = list(entry.route)
      const isRoute = (r: Row): boolean => r.segs.length > 1 && r.segs.slice(1).every((seg) => route.includes(seg.text) || seg.text === ' › ')
      let from = body.length
      while (from > 0 && isRoute(body[from - 1])) from--
      keep(body.slice(0, from))
      draw(routeSvg(entry, now, cols, input.lang), body.slice(from), false)
    } else if (name === 'clash') draw(clashSvg(entry, input.others, now, cols), body, false)
    else keep(body)
  }
  return parts
}
