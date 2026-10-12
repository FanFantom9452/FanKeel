import type { Register, EngineInterface } from 'claude-code'
import { parentOf, isActive, SESSION_ID, HARD } from './compact.ts'
import { statusRows, width, ledgerDoneIds, planTasks, RAILS } from './pane-status.ts'
import type { Entry, Other, Context, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow } from './pane-status.ts'
import type { Limit } from './pane-bar.ts'
import { taskDir, pendingName, answerName, parsePending, gateRows, answerText, HANDOFF } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'
import { bandRows, GUARD, WHERE, INK } from './pane-band.ts'
import type { Seg as BandSeg } from './pane-band.ts'

// The fankeel mod's two drawings: two rows above the prompt for what is always
// wanted, and the Pane for what is looked up, with whatever gate is waiting on
// top of it. The Pane opens itself while the session owns a task, and again for
// a gate if the user closed it; /fankeel-panel toggles it. docs/90-agent/plans/2026-10-12-pane-band-design.md
// is the design. Nothing here runs unless the module was enabled, and nothing
// outside it depends on it.
export const PANE = 'fankeel'
export const COMMAND = 'fankeel-panel'
export const POLL_MS = 250

// The surfaces measured to draw a Pane. Remote Control attaches none of them, and the mobile app draws no mod.
const PLACES = ['terminal', 'desktop']

type Seen = {
  id: string
  entry: Entry | null
  others: Other[]
  pending: Pending | null
  pendingFile: string | null
  context: Context | null
  limits: Limit[]
  plan: PlanInfo | null
  // What probeOf read, or null while FANKEEL_PANE_PROBE is unset.
  probe: string | null
}

// What a file last parsed to, and the time and size it had then: the tick runs
// four times a second in every session that enabled the mod, and a neighbour's
// registry file or a plan file that has not moved is not read again. The
// session's own registry file, the pending file and the ledger are read every tick.
type Cache = Map<string, { stamp: string; value: unknown }>

const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, pendingFile: null, context: null, limits: [], plan: null, probe: null })

// The last message each silent catch logged: the tick runs four times a second, and a failure that stays is said once.
type Logged = { context: string; plan: string; open: string; registry: string; neighbour: string; gate: string; live: string }

// A registry file that is there and does not parse: told apart so `tick` can wait it out for a while, then give up on it.
class Unreadable extends Error {}

// Five seconds at POLL_MS: how many ticks in a row a registry file may stay unreadable before it counts as no task.
const UNREADABLE_TICKS = 20

function logOnce($: EngineInterface, logged: Logged, key: keyof Logged, text: string): void {
  if (logged[key] === text) return
  logged[key] = text
  $.ui.log(text, { to: 'debug' })
}

async function readJson($: EngineInterface, file: string): Promise<Entry | null> {
  try {
    const got = JSON.parse(String(await $.fs.read(file)))
    return got && typeof got === 'object' && !Array.isArray(got) ? (got as Entry) : null
  } catch {
    return null
  }
}

// hooks/compact.ts findEntry, written again: the engine follows $ only into a
// function of this file, never across an import.
async function findEntry($: EngineInterface, id: string): Promise<{ entry: Entry; root: string } | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    const file = `${root}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      const entry = await readJson($, file)
      // A file that is there and does not parse is one caught mid-write, not a task that ended: `tick` waits for it.
      if (!entry) throw new Unreadable('registry file unreadable: ' + file)
      return { entry, root }
    }
    dir = parentOf(dir)
  }
  return null
}

// The tokens in play against the count hooks/compact.ts compacts at — its
// `threshold`, written again for the same reason as findEntry — and the rate
// limits the same call reports: `five_hour` and `seven_day` are the two drawn.
// No context while the engine has no count; neither when it cannot be asked.
async function contextOf($: EngineInterface, logged: Logged): Promise<{ context: Context | null; limits: Limit[] }> {
  try {
    const usage = await $.session.usage()
    const limits = Array.isArray(usage.rateLimits) ? (usage.rateLimits as Limit[]) : []
    if (typeof usage.context.tokens !== 'number') return { context: null, limits }
    const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
    return { context: { tokens: usage.context.tokens, at: Number.isFinite(raw) && raw > 0 ? raw : HARD }, limits }
  } catch (err) {
    logOnce($, logged, 'context', `fankeel pane: no token count, ${String(err)}`)
    return { context: null, limits: [] }
  }
}

// Where the engine says the session draws, read only while FANKEEL_PANE_PROBE is set: the mod API has no
// Remote Control field, and whether these two answers move when it is switched on is what the probe is for.
async function probeOf($: EngineInterface): Promise<string | null> {
  if (!(await $.env.get('FANKEEL_PANE_PROBE'))) return null
  try {
    return `surfaces [${(await $.session.surfaces()).join(', ')}] · surface ${String(await $.session.surface())}`
  } catch (err) {
    return `surfaces ? · ${String(err)}`
  }
}

// The newest plan this task claimed that has a build ledger of its own: the
// ledger is where lib/ledger.js ledgerPath puts it, and ledgerDoneIds refuses
// one whose first line names another plan. The tasks are the plan's own headings.
async function planOf($: EngineInterface, root: string, entry: Entry, cache: Cache, logged: Logged): Promise<PlanInfo | null> {
  const claims = Array.isArray(entry.claims) ? entry.claims : []
  for (let i = claims.length - 1; i >= 0; i--) {
    const claim = claims[i]
    if (typeof claim !== 'string' || !claim.endsWith('.md')) continue
    const name = claim.slice(Math.max(claim.lastIndexOf('/'), claim.lastIndexOf('\\')) + 1, -3)
    const file = `${root}/.fankeel/build/${name}/progress.md`
    if (!(await $.fs.exists(file))) continue
    const ledger = String(await $.fs.read(file))
    const done = ledgerDoneIds(ledger, claim)
    if (done === null) continue
    let tasks: PlanTask[] = []
    try {
      const planFile = `${root}/${claim}`
      const stat = await $.fs.stat(planFile)
      const stamp = `${stat.mtimeMs}:${stat.size}`
      let hit = cache.get(planFile)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, value: planTasks(String(await $.fs.read(planFile))) }
        cache.set(planFile, hit)
      }
      tasks = hit.value as PlanTask[]
    } catch (err) {
      logOnce($, logged, 'plan', `fankeel pane: plan file unreadable, ${String(err)}`)
    }
    return tasks.length > 0 ? { name, done, tasks } : null
  }
  return null
}

// The neighbours hooks/inject.js found running at this session's last prompt
// (`.fankeel/build/live.json`), or null where that cannot be told: no file, one
// that does not parse, no `at`, or `ids` that is no list — lib/live.js writes
// null there when it could not tell. The mod has no pid to signal, so this file
// is all it knows of who is alive. Read every tick: it is one short line.
async function liveOf($: EngineInterface, root: string, logged: Logged): Promise<{ at: number; ids: string[] } | null> {
  const file = `${root}/.fankeel/build/live.json`
  try {
    if (!(await $.fs.exists(file))) return null
    const got = JSON.parse(String(await $.fs.read(file))) as { at?: unknown; ids?: unknown } | null
    if (!got || typeof got.at !== 'number' || !Number.isFinite(got.at) || !Array.isArray(got.ids)) return null
    return { at: got.at, ids: got.ids.filter((x): x is string => typeof x === 'string') }
  } catch (err) {
    logOnce($, logged, 'live', `fankeel pane: live list does not parse, ${file}, ${String(err)}`)
    return null
  }
}

// Everything both drawings show: this session's entry, the other active
// entries beside it, the gate hooks/gate.js is holding, the context count and
// the plan's ledger; the neighbours and the plan file are read again only when
// their mtimeMs or size changes. The neighbours are read whether or not the
// Pane is up, because the band's flag needs them. A neighbour the live list says has gone is left out of both.
async function look($: EngineInterface, cache: Cache, logged: Logged): Promise<Seen> {
  const id = await $.session.id()
  if (!SESSION_ID.test(id)) return blank(id)
  const found = await findEntry($, id)
  if (!found || !isActive(found.entry)) return blank(id)
  const entry = found.entry as Entry

  const alive = await liveOf($, found.root, logged)
  const others: Other[] = []
  const unreadable: string[] = []
  const sessions = `${found.root}/.fankeel/sessions`
  for (const file of await $.fs.list(sessions)) {
    if (!file.name.endsWith('.json') || file.name === `${id}.json`) continue
    const path = `${sessions}/${file.name}`
    const stamp = `${file.mtimeMs}:${file.size}`
    let hit = cache.get(path)
    if (!hit || hit.stamp !== stamp) {
      hit = { stamp, value: await readJson($, path) }
      // A file that did not parse may be one caught mid-write: it is read again next tick.
      if (hit.value) cache.set(path, hit)
    }
    const other = hit.value as Entry | null
    if (!other) unreadable.push(path)
    // Unknown means live, and so does a registry file that moved after the list was written:
    // a clash shown for a session that has gone is noise, one hidden is two terminals overwriting each other.
    const sid = file.name.slice(0, -5)
    if (other && isActive(other) && (!alive || alive.ids.includes(sid) || file.mtimeMs > alive.at)) others.push({ id: sid, entry: other })
  }
  // All the paths in one line, so two files that stay unreadable do not take turns being logged.
  if (unreadable.length) logOnce($, logged, 'neighbour', `fankeel pane: neighbour registry file unreadable, ${unreadable.join(', ')}`)
  else logged.neighbour = ''

  let pending: Pending | null = null
  let pendingFile: string | null = null
  const dir = taskDir(found.root, entry)
  if (dir && (await $.fs.exists(dir))) {
    const name = pendingName((await $.fs.list(dir)).map((f) => f.name), String(entry.stage))
    if (name) {
      pendingFile = `${dir}/${name}`
      const text = String(await $.fs.read(pendingFile))
      pending = parsePending(text, Date.now())
      if (!pending) {
        // parsePending says null for a gate that expired or has no questions too: only a file that is not JSON is logged.
        try {
          JSON.parse(text)
          logged.gate = ''
        } catch {
          logOnce($, logged, 'gate', `fankeel pane: pending file does not parse, ${pendingFile}`)
        }
        pendingFile = null
      } else logged.gate = ''
    }
  }

  const { context, limits } = await contextOf($, logged)
  const plan = await planOf($, found.root, entry, cache, logged)
  const probe = await probeOf($)
  return { id, entry, others, pending, pendingFile, context, limits, plan, probe }
}

type State = {
  seen: Seen
  print: string
  // Why the pane up now is the mod's, and so when it is the mod's to close: 'task' closes with the task;
  // 'gate' closes when its gate goes, or when the task ends first.
  mine: false | 'task' | 'gate'
  // Whether a task was there, and which pending file, the last time the opens and closes for them went through.
  edge: { task: boolean; gate: string | null }
  // Ticks in a row the registry file was unreadable.
  bad: number
  busy: boolean
  cache: Cache
  logged: Logged
}

// An unplaced pane (narrow terminal) is registered but not drawn: not open.
async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some((pane) => pane.id === PANE && pane.isPlaced)
}

// Declared up here, not inside register: the engine refuses a module that hands $ to a closure.
async function tick($: EngineInterface, state: State): Promise<void> {
  if (state.busy) return
  state.busy = true
  try {
    let next: Seen
    try {
      next = await look($, state.cache, state.logged)
      state.bad = 0
      state.logged.registry = ''
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      state.bad += 1
      logOnce($, state.logged, 'registry', `fankeel pane: ${err.message}`)
      // Caught mid-write: wait, with nothing changed. One that stays unreadable is no task.
      if (state.bad < UNREADABLE_TICKS) return
      next = blank(state.seen.id)
    }
    // The minute is in the key so the minutes, the neighbours' ages and the reset countdowns move while
    // nothing else does; while a gate waits the second is too, for the seconds it has left.
    const clock = next.entry ? await $.clock.now() : 0
    const minute = Math.floor(clock / 60000)
    const second = next.pending ? Math.floor(clock / 1000) : 0
    const now = JSON.stringify([next.entry, next.others, next.pending && next.pending.questions, next.pendingFile, next.context, next.limits, next.plan, next.probe, minute, second])
    // The opens and closes have their own memory, `edge`, which moves only when they all went through: a rejected
    // one is met again next tick as the same edge, while `seen` and the redraw below never wait on them.
    try {
      // Asked here, after `look`: /fankeel-panel may have opened or closed the pane while it read files.
      // A task appears: the pane opens, once; a pane the user then closes stays closed until a gate comes. No toast: the band shows the task.
      if (!state.edge.task && next.entry && !(await isOpen($))) {
        await $.ui.open({ id: PANE, title: 'fankeel' })
        state.mine = 'task'
      }
      if (next.pendingFile && next.pendingFile !== state.edge.gate && !(await isOpen($))) {
        const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
        // Its pane either way, placed now or when the terminal widens; a pane the task owns stays the task's.
        if (state.mine !== 'task') state.mine = 'gate'
        if (!opened.isPlaced) $.ui.toast('fankeel：有一個 gate 在等。/fankeel-panel 開面板，或在終端回答')
      }
      if (!next.pendingFile && state.edge.gate && state.mine === 'gate') {
        await $.ui.close({ id: PANE })
        state.mine = false
      }
      if (state.edge.task && !next.entry && state.mine) {
        // Not asked whether it is open: a pane registered but not placed (a narrow terminal) is still the mod's to close.
        await $.ui.close({ id: PANE })
        state.mine = false
      }
      state.edge = { task: !!next.entry, gate: next.pendingFile }
      state.logged.open = ''
    } catch (err) {
      logOnce($, state.logged, 'open', `fankeel pane: pane not opened or closed, ${String(err)}`)
    }
    state.seen = next
    if (now !== state.print) {
      state.print = now
      $.ui.invalidate('ui.render')
    }
  } catch (err) {
    $.ui.log(`fankeel pane: tick skipped, ${String(err)}`, { to: 'debug' })
  } finally {
    state.busy = false
  }
}

// Writes `text` to the answer file of the gate that was drawn, unless the
// gate is already gone or an answer newer than the wait's start is there
// (the station got there first). An older one is an earlier gate's:
// lib/handoff.js answersSince reads only a file newer than the wait.
async function answer($: EngineInterface, pending: Pending, pendingFile: string, text: string | null): Promise<void> {
  try {
    const file = answerName(pendingFile)
    if (!text || !(await $.fs.exists(pendingFile))) return
    if ((await $.fs.exists(file)) && (pending.at === null || (await $.fs.stat(file)).mtimeMs > pending.at)) return
    await $.fs.write(file, text)
  } catch (err) {
    $.ui.log(`fankeel pane: answer not written, ${String(err)}`, { to: 'debug' })
    $.ui.toast('fankeel：答案沒寫成，請在終端回答')
  }
}

export const register: Register = (on) => {
  const state: State = {
    seen: blank(''), print: '', mine: false, edge: { task: false, gate: null }, bad: 0, busy: false, cache: new Map(),
    logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '' },
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：任務、等待中的 gate、撞檔、tasks、context、用量額度與 notes' })
    $.clock.every(POLL_MS, () => tick($, state))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($) => {
    state.mine = false
    if (await isOpen($)) {
      await $.ui.close({ id: PANE })
      return { text: 'fankeel 面板已關閉。' }
    }
    const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
    await tick($, state)
    if (opened.isPlaced) return { text: 'fankeel 面板已開啟。' }
    const surfaces = await $.session.surfaces()
    if (!surfaces.some((surface) => PLACES.includes(surface))) return { text: 'fankeel 面板開不了：這裡畫不了面板，請在終端或 Claude Desktop 開。' }
    return { text: opened.reason ? `fankeel 面板開不了：${opened.reason}` : 'fankeel 面板開不了：終端太窄。' }
  })

  // Two rows while the session owns a task; otherwise the band is the next hook's, and with none it is not drawn.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const seen = state.seen
    const props = (e.props ?? {}) as { hasSurvey?: boolean; bodyColumns?: number }
    if (props.hasSurvey) return next(e)
    // 5: the cells the engine keeps at the band's right end, where no surface has measured the body.
    const cols = Math.max(20, props.bodyColumns ?? (e.viewport?.columns ?? 85) - 5)
    const plan = seen.plan
    const rows = bandRows({
      entry: seen.entry,
      others: seen.others,
      gateUntil: seen.pending ? seen.pending.until : null,
      context: seen.context,
      limits: seen.limits,
      tasks: plan ? { done: plan.tasks.filter((t) => plan.done.includes(t.n)).length, total: plan.tasks.length } : null,
      cols,
      now: Date.now(),
    })
    if (!rows) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const cell = (seg: BandSeg) => {
      const text = h(Text, { color: seg.color, backgroundColor: seg.backgroundColor, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
      return seg.gap ? [h(Text, {}, ' '.repeat(seg.gap)), text] : [text]
    }
    return h(Box, { flexDirection: 'column' }, ...rows.map((row) => h(Box, { flexDirection: 'row' }, ...row.flatMap(cell))))
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const seen = state.seen
    const props = (e.props ?? {}) as { bodyColumns?: number; scroll?: { bodyRows?: number } }
    // The body's own cells where the surface measured them (41 by 32 on Claude Desktop); the viewport is the whole surface.
    const cols = Math.max(20, props.bodyColumns ?? (e.viewport?.columns ?? 44) - 2)
    const room = Math.max(1, props.scroll?.bodyRows ?? (e.viewport?.rows ?? 24) - 4)
    const pending = seen.pending
    const pendingFile = seen.pendingFile
    // The gate is drawn whole, under the task block, and the Pane scrolls over it; the status blocks take the rows it leaves.
    // 1: the rail every gate row opens with; a status row opens with a rail or a space, the same one cell.
    const gate = pending && pendingFile ? gateRows(pending, cols - 1, width, Date.now()) : []
    const status = statusRows({
      id: seen.id,
      entry: seen.entry,
      others: seen.others,
      context: seen.context,
      plan: seen.plan,
      cols,
      room: room - gate.length - (gate.length ? 1 : 0),
      now: Date.now(),
      probe: seen.probe,
    })
    const blankRow = () => h(Text, {}, ' ')
    // A row's segments touch: each carries its own colour, and its own space where it wants one.
    const piece = (seg: StatusSeg) => h(Text, { color: seg.color, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
    const line = (row: StatusRow) => (row.segs.length === 0 ? blankRow() : h(Box, { flexDirection: 'row' }, ...row.segs.map(piece)))
    const railed = (...cells: unknown[]) => h(Box, { flexDirection: 'row' }, h(Text, { color: RAILS.gate }, '▌'), ...cells)
    // The task block stays on top; the blank row statusRows puts above the block after it parts the gate from the rest.
    const top = status.filter((row) => row.block === 'task')

    const drawn = [
      ...top.map(line),
      ...(gate.length && top.length ? [blankRow()] : []),
      ...gate.map((row) => {
        if (row.press !== undefined && pending && pendingFile) {
          return railed(h(Button, {
            key: `gate:${row.hotkey}`,
            hotkey: row.hotkey,
            plain: true,
            onPress: () => answer($, pending, pendingFile, row.press === '' ? HANDOFF : answerText(pending, row.press as string)),
          }, row.text))
        }
        if (row.badge) {
          const badge = h(Text, { backgroundColor: GUARD, color: INK, bold: true }, ` ${row.text} `)
          return row.after ? railed(badge, h(Text, { color: GUARD, bold: true }, `  ${row.after}`)) : railed(badge)
        }
        return railed(h(Text, { bold: row.bold, color: row.dim ? WHERE : undefined, wrap: 'truncate-end' }, row.text))
      }),
      ...status.filter((row) => row.block !== 'task').map(line),
    ]
    return h(Box, { flexDirection: 'column' }, ...drawn)
  })
}
