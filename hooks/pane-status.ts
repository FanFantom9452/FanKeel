// The status half of the fankeel Pane: a registry entry and the engine's
// numbers in, rows out. No engine call here, so tests/pane-status.test.js runs
// it under plain node. What each block holds is
// docs/90-agent/plans/2026-10-12-pane-band-design.md section 3.

import { WHERE, FLAG, GUARD, TODO, claimsOf } from './pane-band.ts'
import { str, list, width, cut, WIDE, DIM, minutes } from './pane-bar.ts'
import { tokenLabel } from './pane-agents.ts'
import type { AgentNode } from './pane-agents.ts'
import { cutShells, commandLine, KEEP_MS } from './pane-shell.ts'
import type { Shell } from './pane-shell.ts'
import { say } from './pane-lang.ts'
import type { Lang } from './pane-lang.ts'

// Kept as exports of this file: hooks/pane.ts imports them from here.
export { str, list, width, cut, WIDE }

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// `color` is a hex, or absent for the terminal's own. The segments of a row
// touch: one that wants a space before it carries the space in its text.
// `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page,
// 'fold' folds or opens the block `fold` names, and 'todo' opens the station at the hash `to`.
export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' | 'fold' | 'todo'; fold?: Fold; to?: string }
// The blocks a head row folds; docs/90-agent/plans/2026-10-17-pane-fold-todo-design.md sections 1 and 2.
export type Fold = 'route' | 'tasks' | 'todo' | 'agents' | 'shells'
// One open entry of the project's TODO bucket (hooks/pane.ts todosOf): its file name without `.md`, its title, its state.
export type TodoEntry = { id: string; title: string; state: string }
// One drawn row. No segments is the blank row above a block. `who` is the
// neighbour a clash row names: hooks/pane.ts counts them against the band's flag.
export type Row = { block: string; segs: Seg[]; who?: string }
// A task of the plan: its number, its heading, whether it is the user's to do, and its
// first `**Dispatch:**` line up to its ` — ` (`implementer, sonnet`), '' where it has none.
export type PlanTask = { n: number; name: string; user: boolean; dispatch?: string }
// A plan's build ledger: its basename, the task numbers recorded complete, the tasks it has.
export type PlanInfo = { name: string; done: number[]; tasks: PlanTask[] }
export type StatusInput = {
  id: string
  entry: Entry | null
  others: Other[]
  plan: PlanInfo | null
  cols: number
  room: number
  now: number
  probe?: string | null
  // When the question the pending file holds went out; the band reads the same, so both stop together.
  gateAt?: number | null
  // This task's subagents as a tree (hooks/pane-agents.ts agentTree); absent or empty draws no block.
  agents?: AgentNode[]
  // This session's background shells (hooks/pane.ts shellsOf); absent, or none running or lately ended, draws no block.
  shells?: Shell[]
  // The station's url, from <configDir>/fankeel/serve.json (hooks/pane.ts stationOf); absent or null when none is up.
  station?: string | null
  // The blocks folded to their head row (hooks/pane.ts state); absent is every block open.
  folded?: Partial<Record<Fold, boolean>>
  // The project's open TODO entries, Ready first (hooks/pane.ts todosOf), and the station's key for the project.
  todos?: TodoEntry[]
  pkey?: string
  // The words' language, the machine profile's ui.lang (hooks/pane-lang.ts langAt); absent is Chinese.
  lang?: Lang
}

// Each block's rail, a fixed colour whatever the stage, on its first drawn row;
// an alarm (ALARMS) carries it on every row. The task block has
// no colour: its rail is the terminal's own.
export const RAILS: Record<string, string> = {
  clash: FLAG,
  tasks: WHERE,
  agents: WHERE,
  shells: WHERE,
  notes: WHERE,
  todo: WHERE,
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
// A fold head: ▾ while the block under it is open, ▸ while it is folded, drawn as a Button.
const head = (fold: Fold, folded: boolean, text: string): Seg => ({ text: `${folded ? '▸' : '▾'} ${text}`, color: WHERE, bold: true, press: 'fold', fold })

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
      task = { n: Number(t[1]), name: t[2].trim(), user: false, dispatch: '' }
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
    task.dispatch = d[1].split(' — ')[0].trim()
    const word = /^([a-z][a-z-]*)/i.exec(d[1])
    task.user = !!word && word[1].toLowerCase() === 'user'
  }
  return tasks
}

// `inner` is the cells a row has after its rail.
function taskBlock(entry: Entry, inner: number, folded: boolean): Row[] {
  const rows = wrap(str(entry.task) || '—', inner).map((text) => row('task', { text, bold: true }))
  const next = str(entry.next)
  // 5: the cells of `next:`, which opens the first row.
  wrap(next ? `next: ${next}` : '', inner).forEach((text, i) => {
    rows.push(i ? row('task', { text }) : row('task', dim(text.slice(0, 5)), { text: text.slice(5) }))
  })
  // The stations behind the stage are green, the stage is the terminal's own and bold, those ahead are grey.
  const route = list(entry.route)
  const at = route.indexOf(str(entry.stage))
  // The route opens with its head row, `▾ route 2/6`; folded, the head alone, with the stage after it.
  if (at >= 0) rows.push(row('task', head('route', folded, `route ${at + 1}/${route.length}${folded ? ` ${route[at]}` : ''}`)))
  if (at >= 0 && !folded) {
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

// The subagent a task's row reads its model, minutes and tokens from: the newest
// in the whole tree whose title names `task <n>` — lib/detail.js TASK_REF ties a
// dispatch to a task the same way, and by nothing else.
const TASK_REF = /\btask\s+(\d+)\b/i
export function agentOf(nodes: AgentNode[], n: number): AgentNode | null {
  const all = (list: AgentNode[]): AgentNode[] => list.flatMap((a) => [a, ...all(a.kids)])
  let best: AgentNode | null = null
  for (const a of all(nodes)) {
    const m = TASK_REF.exec(a.title || '')
    if (!m || Number(m[1]) !== n) continue
    // A reviewer's title can name the task too; the row is the implementer's.
    const rank = /implementer$/.test(a.type || '') ? 1 : 0
    const held = best ? (/implementer$/.test(best.type || '') ? 1 : 0) : -1
    if (rank > held || (rank === held && a.at > best!.at)) best = a
  }
  return best
}

// The model a plan's Dispatch line names: `implementer, sonnet, high` is sonnet;
// `in-session` is itself; any other line is ''.
export function dispatchModel(dispatch: string): string {
  const m = /^implementer,\s*([a-z][a-z0-9.-]*)/i.exec(dispatch)
  if (m) return m[1]
  return /^in-session\b/i.test(dispatch) ? 'in-session' : ''
}

// The plan's tasks against its ledger. Six or fewer are listed; more fold to
// the count done, the first open task and the two after it, and how many are
// left — six rows at most. Each row names who it went to: the subagent whose
// title names the task (agentOf) with its model, minutes and tokens, running
// while that agent runs; before one has gone out, the plan's Dispatch model.
// `inflight` is one mark, or a list of them once two agents are out
// (lib/registry.js inflights); with no agent tied to an open task by name, the
// mark is drawn on the first open task that is not the user's. With no ledger, a
// mark on this stage is one row of its own.
function tasksBlock(entry: Entry, plan: PlanInfo | null, agents: AgentNode[], inner: number, now: number, folded: boolean, lang?: Lang): Row[] {
  if (!plan || !plan.tasks.length) return []
  const stage = str(entry.stage)
  const marks = Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]
  const mark = marks.map(record).find((m) => m.stage === stage)
  const known = !!mark && typeof mark.at === 'number' && Number.isFinite(mark.at)
  const out = mark ? mins(known ? now - (mark.at as number) : null) : ''
  const late = known && Number(out) >= LONG
  const done = new Set(plan.done)
  const open = plan.tasks.filter((t) => !done.has(t.n))
  const count = plan.tasks.length - open.length
  const live = (t: PlanTask): boolean => {
    const a = agentOf(agents, t.n)
    return !!a && a.end === null
  }
  const running = mark && !open.some(live) ? open.find((t) => !t.user) : undefined
  // Numbers right-aligned to the widest one.
  const pad = String(Math.max(...plan.tasks.map((t) => t.n))).length
  const one = (t: PlanTask): Row => {
    const label = ` ${String(t.n).padStart(pad)} `
    // 1: the mark every task row opens with.
    const name = (after: string): string => label + cut(t.name, Math.max(4, inner - 1 - width(label) - width(after)))
    const agent = agentOf(agents, t.n)
    const spent = agent && typeof agent.tokens === 'number' ? ` · ${tokenLabel(agent.tokens)}` : ''
    const model = dispatchModel(str(t.dispatch))
    const by = agent ? ` · ${agent.model} · ${say(lang, 'status.min', { n: mins((agent.end ?? now) - agent.at) })}${spent}` : model ? ` · ${model}` : ''
    if (done.has(t.n)) return row('tasks', { text: '●', color: DONE }, dim(name(by) + by))
    if (agent && agent.end === null) return row('tasks', { text: '◉', color: OUT }, { text: name(by), bold: true }, { text: by, color: OUT })
    if (t === running) {
      const after = say(lang, 'status.out', { n: out })
      return row('tasks', { text: '◉', color: OUT }, { text: name(after), bold: true }, { text: after, color: late ? GUARD : OUT })
    }
    if (t.user) return row('tasks', { text: '◐', color: GUARD }, { text: name(say(lang, 'status.yours')) }, dim(say(lang, 'status.yours')))
    return row('tasks', { text: '○', color: TODO }, { text: name(by) }, dim(by))
  }
  const top = row('tasks', head('tasks', folded, `tasks ${count}/${plan.tasks.length}`))
  if (folded) return [top]
  if (plan.tasks.length <= WHOLE) return [top, ...plan.tasks.map(one)]
  const rows = [top]
  if (count) rows.push(row('tasks', { text: '✓', color: DONE }, dim(say(lang, 'status.done', { n: count }))))
  rows.push(...open.slice(0, 3).map(one))
  const rest = open.slice(3)
  if (rest.length) {
    const yours = rest.filter((t) => t.user).length
    rows.push(row('tasks', { text: '○', color: TODO }, dim(say(lang, 'status.rest', { n: rest.length }) + (yours ? say(lang, 'status.restYours', { n: yours }) : ''))))
  }
  return rows
}

// The station, the foot's last row: a button that opens its page and the whole
// url beside it, or grey words saying none is up. The terminal draws the
// button as `[ label ]`, four cells wider than its label; a Pane narrower than
// the url cuts the url's end.
function stationRow(url: string | null | undefined, inner: number, lang?: Lang): Row {
  if (!url) return row('foot', dim(cut(say(lang, 'status.noStation'), inner)))
  const label = say(lang, 'status.open')
  return row('foot', { text: label, press: 'station' }, dim(cut(` ${url}`, Math.max(4, inner - width(label) - 4))))
}

// lib/todo.js STATES, the four the TODO block has a Button for, in the station panel's order, each with its label.
export const TODO_STATES: [string, string][] = [['ready', 'Ready'], ['decision', 'Needs a decision'], ['blocked', 'Blocked'], ['watch', 'Watch']]

// The project's open TODO entries under a fold head that counts them, then the
// four states each with its count: a state with entries is a Button opening the
// station's TODO panel on that state's group (`todo/state:<state>`, the id
// assets/station/station.js gives the group's heading), a state with none is grey
// words. The counts share one row when they fit `inner` and fall to two rows of
// two when they do not; no title is listed, so the block is three rows at most.
// The terminal draws a Button four cells wider than its label. No entries, no block.
function todoBlock(todos: TodoEntry[], pkey: string, inner: number, folded: boolean): Row[] {
  if (!todos.length) return []
  const at = `#/p/${encodeURIComponent(pkey)}/todo`
  const rows = [row('todo', head('todo', folded, `TODO ${todos.length}`))]
  if (folded) return rows
  const keys = TODO_STATES.map(([state, label]): Seg => {
    const n = todos.filter((t) => t.state === state).length
    if (!n) return dim(`${label} 0`)
    return { text: `${label} ${n}`, press: 'todo', to: `${at}/${encodeURIComponent(`state:${state}`)}` }
  })
  const gap: Seg = { text: ' ' }
  const cells = keys.reduce((sum, k) => sum + width(k.text) + (k.press ? 4 : 0), 0) + 3
  if (cells <= inner) rows.push(row('todo', keys[0], gap, keys[1], gap, keys[2], gap, keys[3]))
  else rows.push(row('todo', keys[0], gap, keys[1]), row('todo', keys[2], gap, keys[3]))
  return rows
}

// A row cut to `cols` cells: the segment that crosses the edge is cut, and the ones after it go.
function fit(r: Row, cols: number): Row {
  let left = cols
  const segs: Seg[] = []
  for (const seg of r.segs) {
    // The terminal draws a Button four cells wider than its label.
    const extra = seg.press ? 4 : 0
    if (left - extra <= 0) break
    const w = width(seg.text)
    segs.push(w + extra <= left ? seg : { ...seg, text: cut(seg.text, left - extra) })
    left -= w + extra
  }
  return { ...r, segs }
}

// The most roots the agents block lists, and the most agents under each.
const AGENT_ROOTS = 6
const AGENT_KIDS = 3

// This task's subagents: a fold head, `▾ agents` with how many run and how many
// stopped, then a row an agent — ○ running in OUT, ● stopped in DONE — its title, its
// model, its effort, its minutes, out so far or out in all, and the tokens it
// spent where its transcript was there to read. An agent's
// own agents sit under it behind ├ and └, one level drawn; the counts in the
// head row include every descendant, drawn or not. Folded, the head row alone.
function agentsBlock(nodes: AgentNode[], inner: number, now: number, folded: boolean, lang?: Lang): Row[] {
  if (!nodes.length) return []
  const all = (list: AgentNode[]): AgentNode[] => list.flatMap((n) => [n, ...all(n.kids)])
  const every = all(nodes)
  const running = every.filter((n) => n.end === null).length
  const one = (n: AgentNode, lead: string): Row => {
    const spent = typeof n.tokens === 'number' ? ` · ${tokenLabel(n.tokens)}` : ''
    const after = ` · ${n.model} · ${n.effort} · ${say(lang, 'status.min', { n: mins((n.end ?? now) - n.at) })}${spent}`
    const name = cut(n.title || n.type || n.id, Math.max(4, inner - width(lead) - 2 - width(after)))
    const mark: Seg = n.end === null ? { text: '○', color: OUT } : { text: '●', color: DONE }
    return row('agents', { text: lead }, mark, n.end === null ? { text: ` ${name}`, bold: true } : dim(` ${name}`), dim(after))
  }
  const rows = [row('agents', head('agents', folded, 'agents'), dim(say(lang, 'status.agents', { r: running, d: every.length - running })))]
  if (folded) return rows
  for (const n of nodes.slice(0, AGENT_ROOTS)) {
    rows.push(one(n, ''))
    const kids = n.kids.slice(0, AGENT_KIDS)
    const folded = n.kids.length > AGENT_KIDS
    kids.forEach((k, i) => rows.push(one(k, i === kids.length - 1 && !folded ? ' └ ' : ' ├ ')))
    if (folded) rows.push(row('agents', dim(say(lang, 'status.kidsMore', { n: n.kids.length - AGENT_KIDS }))))
  }
  if (nodes.length > AGENT_ROOTS) rows.push(row('agents', dim(say(lang, 'status.rootsMore', { n: nodes.length - AGENT_ROOTS }))))
  return rows
}

// This session's background shells: a fold head, `▾ shells` with how many run
// and how many ended within KEEP_MS, then at most three rows (hooks/pane-shell.ts
// cutShells) — ○ running in OUT with its minutes so far, ● ended in DONE with the
// minutes it ran and `exit N`, in FLAG when N is not 0, or 結束 where no code
// could be read. Folded, the head row alone; none to show, no block.
export function shellsBlock(shells: Shell[], inner: number, now: number, folded: boolean, lang?: Lang): Row[] {
  const shown = shells.filter((s) => s.end === null || now - s.end < KEEP_MS)
  if (!shown.length) return []
  const running = shown.filter((s) => s.end === null).length
  const rows = [row('shells', head('shells', folded, 'shells'), dim(say(lang, 'status.shells', { r: running, d: shown.length - running })))]
  if (folded) return rows
  for (const s of cutShells(shells, now)) {
    const ended = s.end !== null
    const after = ` · ${say(lang, 'status.min', { n: mins((s.end ?? now) - s.at) })}${ended ? ' · ' : ''}`
    const exit = !ended ? '' : s.code === null ? say(lang, 'status.ended') : `exit ${s.code}`
    const name = cut(commandLine(s.command), Math.max(4, inner - 2 - width(after) - width(exit)))
    if (!ended) rows.push(row('shells', { text: '○', color: OUT }, { text: ` ${name}`, bold: true }, dim(after)))
    else rows.push(row('shells', { text: '●', color: DONE }, dim(` ${name}${after}`), s.code === null || s.code === 0 ? dim(exit) : { text: exit, color: FLAG }))
  }
  return rows
}

// Given up in this order when the rows do not fit, after the agents' own agents: `todo`, `shells`, `agents` and `tasks` keep their head rows.
// The task, the clash and the foot never go.
const DROP = ['todo', 'notes', 'shells', 'agents', 'tasks']
// The blocks that are alarms, not sections: every row of one keeps its rail.
const ALARMS = ['clash']

export function statusRows(input: StatusInput): Row[] {
  const { id, entry, others, cols, room, now, lang } = input
  if (!entry) {
    return [
      { block: 'empty', segs: [{ text: cut(say(lang, 'status.empty'), cols) }] },
      { block: 'empty', segs: [dim(cut(say(lang, 'status.start'), cols))] },
      // The station row with its rail left off, as the two above have none.
      { block: 'empty', segs: stationRow(input.station, cols, lang).segs.slice(1) },
    ]
  }
  // 1: the cell every drawn row opens with, its block's rail or the space under it.
  const inner = Math.max(4, cols - 1)
  const folded = input.folded ?? {}
  const blocks: Row[][] = [taskBlock(entry, inner, !!folded.route)]
  const clash = clashBlock(entry, others, inner, now)
  if (clash.length) blocks.push(clash)
  const tasks = tasksBlock(entry, input.plan, input.agents ?? [], inner, now, !!folded.tasks, lang)
  if (tasks.length) blocks.push(tasks)
  const agents = agentsBlock(input.agents ?? [], inner, now, !!folded.agents, lang)
  if (agents.length) blocks.push(agents)
  const shells = shellsBlock(input.shells ?? [], inner, now, !!folded.shells, lang)
  if (shells.length) blocks.push(shells)

  // The registry keeps the newest note last.
  const notes = list(entry.notes).slice(-3)
  if (notes.length) blocks.push([row('notes', title('notes', 'notes')), ...notes.map((note) => row('notes', { text: cut(`· ${note}`, inner) }))])

  // With no station up nothing opens a TODO: the foot's `station 未啟動` stands for both.
  const todo = input.station ? todoBlock(input.todos ?? [], input.pkey ?? '', inner, !!folded.todo) : []
  if (todo.length) blocks.push(todo)

  // The probe is asked for by hand (hooks/pane.ts probeOf): it is drawn whole, in the block that never drops.
  const probed = input.probe ? wrap(input.probe, inner).map((text) => row('foot', dim(text))) : []
  blocks.push([...probed, row('foot', dim(cut(say(lang, 'status.close', { id: id.slice(0, 8) }), inner))), stationRow(input.station, inner, lang)])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  // Before any block goes, the agents' own agents do: their rows open with ├ or └.
  const ag = blocks.findIndex((block) => block[0].block === 'agents')
  if (size() > room && ag >= 0) blocks[ag] = blocks[ag].filter((r) => !/^ [├└] /.test(r.segs[1]?.text ?? ''))
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at < 0) continue
    if (name === 'notes') blocks.splice(at, 1)
    // A head cut down to itself says so: its ▾ is the fold's, and would read as open and empty.
    else if (blocks[at].length > 1) blocks[at] = [{ ...blocks[at][0], segs: [...blocks[at][0].segs, dim(say(lang, 'status.noRoom'))] }]
  }
  // A section's rail is on its first drawn row alone: the rows under it open
  // with one plain space instead, so `inner` holds and no wrap or cut moves.
  const railed = blocks.map((block) => (ALARMS.includes(block[0].block) ? block : block.map((r, i) => (i ? { ...r, segs: [{ text: ' ' }, ...r.segs.slice(1)] } : r))))
  return railed.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block)).map((r) => fit(r, cols))
}
