// The desktop drawings of the band and the Pane: the data hooks/pane-band.ts
// and hooks/pane-status.ts turn into rows, turned into `<svg>` strings for the
// engine's Svg element. No engine call here, so tests/pane-svg.test.js runs it
// under plain node. docs/90-agent/plans/2026-10-14-pane-svg-design.md is the
// design; the approved drawing is the mockup .fankeel/build/2026-10-14-pane-svg/gen.mjs wrote.

import { TODO, GUARD, FLAG, WHERE, CLASH, INK, stageColor, since, clashes, claimsOf } from './pane-band.ts'
import type { BandInput } from './pane-band.ts'
import { str, list, kilo, cut, ctxPaint, fivePaint, weekPaint, deviation, limitOf, signed, minutes, secondsLeft, DIM } from './pane-bar.ts'
import type { Context } from './pane-bar.ts'
import { KEPT, SAID } from './pane-status.ts'
import type { Entry, Other, PlanInfo, Row, StatusInput } from './pane-status.ts'
import { HARD } from './compact.ts'

// The engine's bound on SvgProps.source, in characters.
export const SVG_MAX = 131072
// One terminal cell in CSS pixels: the Pane's 41 cells are 328px, the band's 80 are 640px.
export const CELL_PX = 8
// A task complete and an agent out on one: hooks/pane-status.ts DONE and OUT.
const DONE = '#87af5f'
const OUT = '#af87d7'
// The figure on a filled task cell.
const ON_FILL = '#1f1e1d'
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
// The characters a 12px monospace face draws a full em wide: hooks/pane-bar.ts WIDE, and ⚑.
const WIDE_PX = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦⚑]/

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// The drawn width of `s` at `size` px: a wide character is one em, any other three fifths of one.
export const px = (s: string, size = 12): number => [...s].reduce((n, ch) => n + (WIDE_PX.test(ch) ? size : size * 0.6), 0)
const r1 = (n: number): number => Math.round(n * 10) / 10
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

// The head of `s` that fits `room` px, ending in an ellipsis when cut.
export function fitPx(s: string, room: number): string {
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

export function svgDoc(w: number, h: number, body: string, extra = ''): string {
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

// The band's first row: the badge, the route as dots in each station's own
// colour (done filled, here filled in a ring, ahead hollow), the tasks as small
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
  x += px(head) + 14
  if (route.length) {
    const step = 14
    const x0 = x + 6
    const rad = (i: number): number => (i === at ? 6.75 : 4)
    for (let i = 0; i < route.length - 1; i++) {
      const a = x0 + step * i + rad(i) + 1
      const z = x0 + step * (i + 1) - rad(i + 1) - 1
      b += `<line x1="${r1(a)}" y1="11" x2="${r1(z)}" y2="11" stroke="${i < at ? WHERE : TODO}" stroke-width="${i < at ? 1.5 : 1}"/>`
    }
    route.forEach((name, i) => {
      const c = stageColor(name)
      const cx = r1(x0 + step * i)
      if (i < at) b += `<circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>`
      else if (i === at) b += `<circle cx="${cx}" cy="11" r="6" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>`
      else b += `<circle cx="${cx}" cy="11" r="3.25" fill="none" stroke="${c}" stroke-width="1.5"/>`
    })
    x = x0 + step * (route.length - 1) + 7 + 12
  }
  if (tasks && tasks.total > 0) {
    const done = Math.max(0, Math.min(tasks.done, tasks.total))
    // Six px a cell, narrower past thirty so the cells stay within 180px.
    const pitch = Math.min(6, 180 / tasks.total)
    b += text(x, 15, 'tasks')
    x += px('tasks') + 6
    for (let i = 0; i < tasks.total; i++) {
      b += `<rect x="${r1(x + i * pitch)}" y="7" width="${r1(Math.max(1, pitch - 2))}" height="8" rx="1" fill="${i < done ? DONE : DIM}"/>`
    }
    x += tasks.total * pitch + 4
    const n = `${done}/${tasks.total}`
    b += text(x, 15, n, { bold: true })
    x += px(n) + 12
  }
  const waits = record(entry.waited)
  const wait = waits[stage]
  const waited = typeof wait === 'number' && Number.isFinite(wait) ? minutes(wait) : 0
  const started = since(entry, stage)
  const here = started === null ? null : minutes(now - started)
  const hereAt = (x0: number): string =>
    here === null ? '' : text(x0, 15, '本站') + text(x0 + px('本站 '), 15, String(here), { bold: true }) + text(x0 + px(`本站 ${here} `), 15, '分')
  if (gateUntil !== null) {
    const label = 'gate 在等'
    const w = px(label) + 12
    b += `<rect x="${r1(x)}" y="2" width="${r1(w)}" height="18" rx="3" fill="${GUARD}"/>`
    b += text(x + 6, 15, label, { fill: INK, bold: true })
    x += w + 10
    // The ring is full at the gate's whole wait (gate.station), from `at` to `until`.
    const left = secondsLeft(gateUntil, now)
    const whole = gateAt !== null && gateUntil > gateAt ? (gateUntil - gateAt) / 1000 : left
    const share = whole > 0 ? Math.min(1, left / whole) : 0
    const r = 6.5
    const c = 2 * Math.PI * r
    b += `<circle cx="${r1(x)}" cy="11" r="${r}" fill="none" stroke="${DIM}" stroke-width="2.5"/>`
    b += `<circle cx="${r1(x)}" cy="11" r="${r}" fill="none" stroke="${GUARD}" stroke-width="2.5" stroke-dasharray="${r1(c * share)} ${r1(c)}" transform="rotate(-90 ${r1(x)} 11)"/>`
    x += 11
    b += text(x, 15, `${left} 秒`, { fill: GUARD, bold: true })
    x += px(`${left} 秒`) + 12
    b += text(x, 15, `等你 ${waited} 分`, { fill: GUARD })
    x += px(`等你 ${waited} 分`) + 12
    b += hereAt(x)
  } else {
    b += hereAt(x)
    if (here !== null) x += px(`本站 ${here} 分`) + 14
    b += text(x, 15, '等你') + text(x + px('等你 '), 15, String(waited), { bold: true }) + text(x + px(`等你 ${waited} `), 15, '分')
  }
  return svgDoc(cols * CELL_PX, BAND_H, b)
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
  let b = `<rect x="0" y="2" width="3" height="18" fill="${flags ? CLASH : stageColor(str(entry.stage))}"/>`
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
  if (context) {
    const window = context.window
    const sized = typeof window === 'number' && Number.isFinite(window) && window > 0
    const finite = Number.isFinite(context.at)
    const paint = ctxPaint(context.tokens, sized && !finite ? (window as number) : context.at)
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
    b += well(x, five.percentUsed / 100, paint.color)
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
  if (flags) after(`⚑${flags}`, { fill: FLAG, bold: true }, drawn ? 14 : 0)
  return drawn || flags ? svgDoc(cols * CELL_PX, BAND_H, b) : ''
}

// The Pane's width in px: one cell is CELL_PX.
const paneW = (cols: number): number => cols * CELL_PX

type Station = { name: string; state: 'done' | 'here' | 'ahead'; min: number | null; wait: number }

// The route under the task title: a column a station, its dot (done green, here
// a grey ring, ahead hollow), a bar of the minutes it took from the entry's
// `clock` against the longest, and the minutes its gate waited (`waited`) in
// amber at the bar's end. '' when the stage is not on the route.
export function routeSvg(entry: Entry, now: number, cols: number): string {
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
    else if (s.state === 'here') b += `<circle cx="${x}" cy="26" r="6" fill="none" stroke="${WHERE}" stroke-width="2.5"/><circle cx="${x}" cy="26" r="2.5" fill="${WHERE}"/>`
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
    b += text(cx(i), 56, `${s.min}分`, { anchor: 'middle', bold: s.state === 'here' })
    if (s.wait) b += text(cx(i), 72, `等${s.wait}`, { anchor: 'middle', fill: GUARD })
  })
  return svgDoc(W, 78, b)
}

// hooks/pane-status.ts ago: `12m`, `3h`, or '' where `updated` does not parse.
function ago(updated: unknown, now: number): string {
  const at = typeof updated === 'string' ? Date.parse(updated) : NaN
  if (!Number.isFinite(at)) return ''
  const m = Math.max(0, Math.floor((now - at) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`
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

// Up to this many tasks: one row of 30px cells. Up to GRID_MAX: rows of ten
// 24px cells, so task n sits on row ceil(n/10). More: one bar of four parts.
const ONE_ROW = 9
const GRID_MAX = 30
// A cell's hover ring, and the out task's breathing outline; still under reduced motion.
const TASKS_STYLE = `<style>.fk-t rect.c{transition:stroke-width .15s ease-out}.fk-t g.k:hover rect.c{stroke:${WHERE};stroke-width:2.5}.fk-t .live{animation:fk-pulse 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes fk-pulse{0%,100%{opacity:.9}50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.fk-t .live{animation:none}}</style>`

// The plan's tasks against its ledger, drawn by how many there are. Every cell
// and every part of the bar carries a <title>; the titles and the hover
// need the Svg drawn interactive, which the caller sets. The agent is on the first open task that is not the user's, as
// hooks/pane-status.ts tasksBlock draws it; under the cells or the bar, that
// task and up to three of the user's are named.
export function tasksSvg(entry: Entry, plan: PlanInfo, now: number, cols: number): string {
  const W = paneW(cols)
  const done = new Set(plan.done)
  const open = plan.tasks.filter((t) => !done.has(t.n))
  const stage = str(entry.stage)
  const marks = (Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]).filter(Boolean)
  const mark = marks.map(record).find((m) => m.stage === stage)
  const running = mark ? open.find((t) => !t.user) : undefined
  const out = mark && typeof mark.at === 'number' && Number.isFinite(mark.at) ? String(minutes(now - mark.at)) : '?'
  const you = open.filter((t) => t.user)
  const n = plan.tasks.length
  const count = n - open.length
  let b = TASKS_STYLE + text(0, 14, 'tasks', { bold: true }) + text(px('tasks '), 14, `${count} of ${n}`)
  let y = 0
  if (n <= GRID_MAX) {
    const [S, G, per] = n <= ONE_ROW ? [30, 4, ONE_ROW] : [24, 5, 10]
    plan.tasks.forEach((t, i) => {
      const x = (i % per) * (S + G) + 1
      const top = 24 + Math.floor(i / per) * (S + G)
      const ty = top + S / 2 + 4
      const isDone = done.has(t.n)
      const tip = `${t.n} · ${t.name}${isDone ? ' · 完成' : t === running ? ` · agent 出去 ${out} 分` : t.user ? ' · 你的' : ' · 還沒做'}`
      let cell: string
      if (isDone) {
        cell = `<rect class="c" x="${x}" y="${top}" width="${S}" height="${S}" rx="4" fill="${DONE}"/>` + text(x + S / 2, ty, String(t.n), { anchor: 'middle', fill: ON_FILL, bold: true })
      } else if (t === running) {
        cell = `<rect class="live" x="${x - 2}" y="${top - 2}" width="${S + 4}" height="${S + 4}" rx="5" fill="none" stroke="${OUT}" stroke-width="1.5"/>`
          + `<rect class="c" x="${x}" y="${top}" width="${S}" height="${S}" rx="4" fill="${OUT}"/>` + text(x + S / 2, ty, String(t.n), { anchor: 'middle', fill: ON_FILL, bold: true })
      } else if (t.user) {
        cell = `<rect class="c" x="${x + 1}" y="${top + 1}" width="${S - 2}" height="${S - 2}" rx="4" fill="none" stroke="${GUARD}" stroke-width="2"/>` + text(x + S / 2, ty, String(t.n), { anchor: 'middle', fill: GUARD, bold: true })
      } else {
        cell = `<rect class="c" x="${x + 0.5}" y="${top + 0.5}" width="${S - 1}" height="${S - 1}" rx="4" fill="none" stroke="${TODO}" stroke-width="1"/>` + text(x + S / 2, ty, String(t.n), { anchor: 'middle' })
      }
      b += `<g class="k"><title>${esc(tip)}</title>${cell}</g>`
    })
    const rows = Math.ceil(n / per)
    y = 24 + rows * S + (rows - 1) * G + 22
  } else {
    // One bar of four parts in this order: done, running, the user's, not begun.
    const parts = [
      { k: count, label: '完成', color: DONE, fill: true, live: false },
      { k: running ? 1 : 0, label: '在跑', color: OUT, fill: true, live: true },
      { k: you.length, label: '你的', color: GUARD, fill: false, live: false },
      { k: open.length - (running ? 1 : 0) - you.length, label: '還沒做', color: TODO, fill: false, live: false },
    ].filter((q) => q.k > 0)
    const G = 2
    const room = W - 2 - G * (parts.length - 1)
    const ws = parts.map((q) => Math.max(6, (q.k / n) * room))
    // A part kept at its 6px floor takes its width from the widest.
    ws[ws.indexOf(Math.max(...ws))] -= ws.reduce((s, w) => s + w, 0) - room
    let x = 1
    parts.forEach((q, i) => {
      const w = ws[i]
      const shape = q.fill
        ? `<rect class="c${q.live ? ' live' : ''}" x="${r1(x)}" y="24" width="${r1(w)}" height="14" rx="4" fill="${q.color}"/>`
        : `<rect class="c" x="${r1(x + 0.75)}" y="24.75" width="${r1(w - 1.5)}" height="12.5" rx="4" fill="none" stroke="${q.color}" stroke-width="1.5"/>`
      b += `<g class="k"><title>${esc(`${q.label} ${q.k}`)}</title>${shape}</g>`
      x += w + G
    })
    let lx = 1
    for (const q of parts) {
      b += q.fill
        ? `<rect x="${r1(lx)}" y="47" width="10" height="10" rx="2" fill="${q.color}"/>`
        : `<rect x="${r1(lx + 1)}" y="48" width="8" height="8" rx="2" fill="none" stroke="${q.color}" stroke-width="2"/>`
      const k = String(q.k)
      b += text(lx + 15, 56, k, { bold: true }) + text(lx + 15 + px(k + ' '), 56, q.label)
      lx += 15 + px(`${k} ${q.label}`) + 14
    }
    y = 80
  }
  if (running) {
    const tail = ` · 出去 ${out} 分`
    b += `<rect x="1" y="${y - 9}" width="10" height="10" rx="2" fill="${OUT}"/>`
    b += text(18, y, fitPx(`${running.n} ${running.name}`, W - 18 - px(tail)) + tail)
    y += 20
  }
  for (const t of you.slice(0, 3)) {
    b += `<rect x="2" y="${y - 8}" width="8" height="8" rx="2" fill="none" stroke="${GUARD}" stroke-width="2"/>`
    b += text(18, y, fitPx(`${t.n} ${t.name}`, W - 18 - px(' · 你的')) + ' · 你的')
    y += 20
  }
  if (you.length > 3) {
    b += text(18, y, `還有 ${you.length - 3} 個是你的`, { fill: GUARD })
    y += 20
  }
  return svgDoc(W, y - 14, b, ' class="fk-t"')
}

// The context meter, drawn where the text block is (from four fifths of the
// threshold): the threshold is the scale, an amber line at four fifths and a
// grey one at the compact point. compact.at off is an infinite threshold: the
// scale is HARD and the compact point is dashed, for no compact runs there.
export function contextSvg(context: Context, cols: number): string {
  const off = !Number.isFinite(context.at)
  const at = off ? HARD : context.at
  const hot = context.tokens >= at
  const paint = ctxPaint(context.tokens, at)
  const W = paneW(cols) - 2
  const said = hot ? (off ? SAID.hotOff : SAID.hot) : off ? SAID.nearOff : SAID.near
  let b = text(0, 14, 'context', { bold: true }) + text(px('context  '), 14, said, hot ? { fill: GUARD, bold: true } : {})
  b += `<rect x="1" y="24" width="${r1(W)}" height="10" rx="2" fill="${DIM}"/>`
  b += `<rect x="2" y="25" width="${r1(Math.min(1, context.tokens / at) * (W - 2))}" height="8" rx="1.5" fill="${paint.color}"/>`
  const x80 = 2 + 0.8 * (W - 2)
  b += `<rect x="${r1(x80 - 1)}" y="20" width="2" height="18" rx="1" fill="${GUARD}"/>`
  b += off
    ? `<line x1="${r1(W)}" y1="19" x2="${r1(W)}" y2="39" stroke="${WHERE}" stroke-width="2" stroke-dasharray="3 2"/>`
    : `<rect x="${r1(W - 1)}" y="20" width="2" height="18" rx="1" fill="${WHERE}"/>`
  const left = at - context.tokens
  const count = kilo(context.tokens)
  b += text(1, 52, count, { bold: true }) + text(1 + px(count), 52, left > 0 ? `，再 ${kilo(left)} 到門檻` : off ? `，過了內建的 ${kilo(at)}` : '，過了門檻')
  b += text(x80, 52, '80%', { anchor: 'middle', fill: GUARD })
  b += text(W + 1, 52, kilo(at), { anchor: 'end' })
  b += text(1, 72, off ? '不會自動壓縮；要壓縮請手動 /compact' : cut(`留 ${KEPT.join(' · ')}`, 40))
  return svgDoc(W + 2, 78, b)
}

// One piece of the desktop Pane, top to bottom: rows drawn as Text, as the
// terminal draws them, or one Svg.
export type Part = { rows: Row[] } | { source: string; alt: string; isInteractive?: boolean }

// The desktop Pane from the rows statusRows drew for the same input: the task
// title, `next:`, notes and the foot stay rows; the route rows, the clash, the
// tasks and the context block become one Svg each, whose alt is those rows'
// text. A block statusRows cut to its title (the tasks, when the Pane is short),
// a drawing with nothing in it, or one over SVG_MAX stays rows.
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
  const { entry, plan, context, now, cols } = input
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
      draw(routeSvg(entry, now, cols), body.slice(from), false)
    } else if (name === 'clash') draw(clashSvg(entry, input.others, now, cols), body, false)
    else if (name === 'tasks' && plan && plan.tasks.length && body.length > 1) draw(tasksSvg(entry, plan, now, cols), body, true)
    else if (name === 'context' && context) draw(contextSvg(context, cols), body, false)
    else keep(body)
  }
  return parts
}
