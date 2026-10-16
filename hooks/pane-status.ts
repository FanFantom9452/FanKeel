// The status half of the fankeel Pane: a registry entry and the engine's
// numbers in, rows out. No engine call here, so tests/pane-status.test.js runs
// it under plain node. What each block holds is
// docs/90-agent/plans/2026-10-12-pane-band-design.md section 3.

import { WHERE, FLAG, GUARD, TODO, claimsOf } from './pane-band.ts'
import { str, list, width, cut, WIDE, DIM, minutes, nearCompact } from './pane-bar.ts'
import type { Context } from './pane-bar.ts'
import { HARD } from './compact.ts'
import type { AgentNode } from './pane-agents.ts'

// Kept as exports of this file: hooks/pane.ts imports them from here.
export { str, list, width, cut, WIDE }
export type { Context }

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// `color` is a hex, or absent for the terminal's own. The segments of a row
// touch: one that wants a space before it carries the space in its text.
// `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page.
export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' }
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
  plan: PlanInfo | null
  cols: number
  room: number
  now: number
  probe?: string | null
  // The mod saw turn.start and not yet turn.complete.
  turn?: boolean
  // When the question the pending file holds went out; the band reads the same, so both stop together.
  gateAt?: number | null
  // This task's subagents as a tree (hooks/pane-agents.ts agentTree); absent or empty draws no block.
  agents?: AgentNode[]
  // The station's url, from <configDir>/fankeel/serve.json (hooks/pane.ts stationOf); absent or null when none is up.
  station?: string | null
}

// Each block's rail, a fixed colour whatever the stage, on its first drawn row;
// an alarm (ALARMS) carries it on every row. The task block has
// no colour: its rail is the terminal's own.
export const RAILS: Record<string, string> = {
  clash: FLAG,
  tasks: WHERE,
  agents: WHERE,
  context: WHERE,
  notes: WHERE,
  foot: DIM,
}

const rail = (block: string): Seg => (Object.hasOwn(RAILS, block) ? { text: '▌', color: RAILS[block] } : { text: '▌' })
// A drawn row: the rail, then the segments that have text. statusRows swaps the rail for a space on a section's later rows.
const row = (block: string, ...segs: Seg[]): Row => ({ block, segs: [rail(block), ...segs.filter((seg) => seg.text)] })
// A block's name, bold in its rail colour.
const title = (block: string, text: string): Seg => ({ text, color: RAILS[block], bold: true })
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
// Labels and secondary text.
const dim = (text: string): Seg => ({ text, color: WHERE })

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
const mins = (ms: unknown): string => (typeof ms === 'number' && Number.isFinite(ms) ? String(minutes(ms)) : '?')

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
  // The stations behind the stage are green, the stage is the terminal's own and bold, those ahead are grey.
  const route = list(entry.route)
  const at = route.indexOf(str(entry.stage))
  if (at >= 0) {
    let cur: Seg[] = []
    let used = 0
    route.forEach((name, i) => {
      const station: Seg = i < at ? { text: name, color: DONE } : i === at ? { text: name, bold: true } : { text: name, color: TODO }
      // 3: the cells of ` › `.
      if (cur.length && used + 3 + width(name) > inner) {
        rows.push(row('task', ...cur))
        cur = []
        used = 0
      }
      if (cur.length) {
        cur.push({ text: ' › ', color: TODO })
        used += 3
      }
      cur.push(station)
      used += width(name)
    })
    rows.push(row('task', ...cur))
  }
  return rows
}

// `12m`, `3h`, or '' where `updated` does not parse.
export function ago(updated: unknown, now: number): string {
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

// A task complete, and an agent out on one.
export const DONE = '#87af5f'
export const OUT = '#af87d7'
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

// What the context block says, read by the desktop Svg (hooks/pane-svg.ts) too, so the two never word it apart.
export const SAID = { hot: '已到門檻，compact 中', near: '快要自動 compact 了', hotOff: '已到門檻，自動 compact 已關閉', nearOff: '快到門檻，自動 compact 已關閉' }

// Drawn only from eighty percent of the threshold (hooks/compact.ts threshold:
// FANKEEL_COMPACT_AT, the profile's compact.at, else HARD), and then never
// given up: that a compact is close, or
// under way, and what one keeps. No count, no bar and no mark: the band's `ctx`
// meter (hooks/pane-band.ts) has those, and a figure is drawn once. compact.at
// off is an infinite threshold: the block is measured against HARD and says
// that no compact will run.
function contextBlock(context: Context, inner: number): Row[] {
  const off = !Number.isFinite(context.at)
  const at = off ? HARD : context.at
  if (!nearCompact(context.tokens, at)) return []
  const hot = context.tokens >= at
  const said = hot ? (off ? SAID.hotOff : SAID.hot) : off ? SAID.nearOff : SAID.near
  return [
    row('context', title('context', 'context'), hot ? { text: `  ${said}`, color: GUARD, bold: true } : dim(`  ${said}`)),
    row('context', dim(cut(off ? '不會自動壓縮；要壓縮請手動 /compact' : `留 ${KEPT.join(' · ')}`, inner))),
  ]
}

// The station, the foot's last row: a button that opens its page and the whole
// url beside it, or grey words saying none is up. The terminal draws the
// button as `[ label ]`, four cells wider than its label; a Pane narrower than
// the url cuts the url's end.
function stationRow(url: string | null | undefined, inner: number): Row {
  if (!url) return row('foot', dim(cut('station 未啟動', inner)))
  const label = '開啟 station'
  return row('foot', { text: label, press: 'station' }, dim(cut(` ${url}`, Math.max(4, inner - width(label) - 4))))
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

// The most roots the agents block lists, and the most agents under each.
const AGENT_ROOTS = 6
const AGENT_KIDS = 3

// This task's subagents: a title row with how many run and how many stopped,
// then a row an agent — ○ running in OUT, ● stopped in DONE — its title, its
// model, its effort and its minutes, out so far or out in all. An agent's
// own agents sit under it behind ├ and └, one level deep.
function agentsBlock(nodes: AgentNode[], inner: number, now: number): Row[] {
  if (!nodes.length) return []
  const all = (list: AgentNode[]): AgentNode[] => list.flatMap((n) => [n, ...all(n.kids)])
  const every = all(nodes)
  const running = every.filter((n) => n.end === null).length
  const one = (n: AgentNode, lead: string): Row => {
    const after = ` · ${n.model} · ${n.effort} · ${mins((n.end ?? now) - n.at)} 分`
    const name = cut(n.title || n.type || n.id, Math.max(4, inner - width(lead) - 2 - width(after)))
    const mark: Seg = n.end === null ? { text: '○', color: OUT } : { text: '●', color: DONE }
    return row('agents', { text: lead }, mark, n.end === null ? { text: ` ${name}`, bold: true } : dim(` ${name}`), dim(after))
  }
  const rows = [row('agents', title('agents', 'agents'), dim(`  ${running} 在跑 · ${every.length - running} 完成`))]
  for (const n of nodes.slice(0, AGENT_ROOTS)) {
    rows.push(one(n, ''))
    const kids = n.kids.slice(0, AGENT_KIDS)
    const folded = n.kids.length > AGENT_KIDS
    kids.forEach((k, i) => rows.push(one(k, i === kids.length - 1 && !folded ? ' └ ' : ' ├ ')))
    if (folded) rows.push(row('agents', dim(` └ 還有 ${n.kids.length - AGENT_KIDS} 個`)))
  }
  if (nodes.length > AGENT_ROOTS) rows.push(row('agents', dim(`還有 ${nodes.length - AGENT_ROOTS} 個`)))
  return rows
}

// Given up in this order when the rows do not fit: `agents` and `tasks` keep their title rows.
// The task, the clash, the context block — drawn
// only once a compact is close — and the foot never go.
const DROP = ['notes', 'agents', 'tasks']
// The blocks that are alarms, not sections: every row of one keeps its rail.
const ALARMS = ['clash']

export function statusRows(input: StatusInput): Row[] {
  const { id, entry, others, cols, room, now } = input
  if (!entry) {
    return [
      { block: 'empty', segs: [{ text: cut('這個 session 沒有進行中的任務', cols) }] },
      { block: 'empty', segs: [dim(cut('/fankeel 開一個', cols))] },
      // The station row with its rail left off, as the two above have none.
      { block: 'empty', segs: stationRow(input.station, cols).segs.slice(1) },
    ]
  }
  // 1: the cell every drawn row opens with, its block's rail or the space under it.
  const inner = Math.max(4, cols - 1)
  const blocks: Row[][] = [taskBlock(entry, inner)]
  const clash = clashBlock(entry, others, inner, now)
  if (clash.length) blocks.push(clash)
  const tasks = tasksBlock(entry, input.plan, inner, now)
  if (tasks.length) blocks.push(tasks)
  const agents = agentsBlock(input.agents ?? [], inner, now)
  if (agents.length) blocks.push(agents)
  const context = input.context ? contextBlock(input.context, inner) : []
  if (context.length) blocks.push(context)

  // The registry keeps the newest note last.
  const notes = list(entry.notes).slice(-3)
  if (notes.length) blocks.push([row('notes', title('notes', 'notes')), ...notes.map((note) => row('notes', { text: cut(`· ${note}`, inner) }))])

  // The probe is asked for by hand (hooks/pane.ts probeOf): it is drawn whole, in the block that never drops.
  const probed = input.probe ? wrap(input.probe, inner).map((text) => row('foot', dim(text))) : []
  blocks.push([...probed, row('foot', dim(cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, inner))), stationRow(input.station, inner)])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at < 0) continue
    if (name === 'tasks' || name === 'agents') blocks[at] = blocks[at].slice(0, 1)
    else blocks.splice(at, 1)
  }
  // A section's rail is on its first drawn row alone: the rows under it open
  // with one plain space instead, so `inner` holds and no wrap or cut moves.
  const railed = blocks.map((block) => (ALARMS.includes(block[0].block) ? block : block.map((r, i) => (i ? { ...r, segs: [{ text: ' ' }, ...r.segs.slice(1)] } : r))))
  return railed.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block)).map((r) => fit(r, cols))
}
