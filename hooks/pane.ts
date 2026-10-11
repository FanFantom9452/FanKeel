import type { Register, EngineInterface } from 'claude-code'
import { parentOf, isActive, SESSION_ID, HARD } from './compact.ts'
import { statusRows, width, cut, ledgerDone, planTotal } from './pane-status.ts'
import type { Entry, Other, Context, PlanCount, Seg as StatusSeg } from './pane-status.ts'
import { taskDir, pendingName, answerName, parsePending, gateRows, answerText, HANDOFF } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'
import { bandRows, stageColor, GUARD, FLAG, TITLE, WHERE, HOLLOW, INK } from './pane-band.ts'
import type { Seg as BandSeg } from './pane-band.ts'

// The fankeel mod's two drawings: two rows above the prompt for what is always
// wanted, and the Pane for what is looked up, with whatever gate is waiting on
// top of it. The Pane opens itself while the session owns a task, and again for
// a gate if the user closed it; /fankeel-pane toggles it. docs/90-agent/plans/2026-10-11-fankeel-pane-design.md, section 6
// over sections 1 to 5. Nothing here runs unless the module was enabled, and
// nothing outside it depends on it.
export const PANE = 'fankeel'
export const COMMAND = 'fankeel-pane'
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
  plan: PlanCount | null
}

// What a file last parsed to, and the time and size it had then: the tick runs
// four times a second in every session that enabled the mod, and a file that
// has not moved is not read again.
type Cache = Map<string, { stamp: string; value: unknown }>

const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, pendingFile: null, context: null, plan: null })

// The last message each silent catch logged: the tick runs four times a second, and a failure that stays is said once.
type Logged = { context: string; plan: string }

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
      return entry && { entry, root }
    }
    dir = parentOf(dir)
  }
  return null
}

// The tokens in play and the count hooks/compact.ts compacts at: its
// `threshold`, written again for the same reason as findEntry. Null while the
// engine has no count, or cannot be asked.
async function contextOf($: EngineInterface, logged: Logged): Promise<Context | null> {
  try {
    const { context } = await $.session.usage()
    if (typeof context.tokens !== 'number') return null
    const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
    return { tokens: context.tokens, at: Number.isFinite(raw) && raw > 0 ? raw : HARD }
  } catch (err) {
    logOnce($, logged, 'context', `fankeel pane: no token count, ${String(err)}`)
    return null
  }
}

// The newest plan this task claimed that has a build ledger of its own: the
// ledger is where lib/ledger.js ledgerPath puts it, and ledgerDone refuses one
// whose first line names another plan. The total is the plan's own headings.
async function planOf($: EngineInterface, root: string, entry: Entry, cache: Cache, logged: Logged): Promise<PlanCount | null> {
  const claims = Array.isArray(entry.claims) ? entry.claims : []
  for (let i = claims.length - 1; i >= 0; i--) {
    const claim = claims[i]
    if (typeof claim !== 'string' || !claim.endsWith('.md')) continue
    const name = claim.slice(Math.max(claim.lastIndexOf('/'), claim.lastIndexOf('\\')) + 1, -3)
    const file = `${root}/.fankeel/build/${name}/progress.md`
    if (!(await $.fs.exists(file))) continue
    const ledger = String(await $.fs.read(file))
    const done = ledgerDone(ledger, claim)
    if (done === null) continue
    let total = 0
    try {
      const planFile = `${root}/${claim}`
      const stat = await $.fs.stat(planFile)
      const stamp = `${stat.mtimeMs}:${stat.size}`
      let hit = cache.get(planFile)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, value: planTotal(String(await $.fs.read(planFile))) }
        cache.set(planFile, hit)
      }
      total = hit.value as number
    } catch (err) {
      logOnce($, logged, 'plan', `fankeel pane: plan file unreadable, ${String(err)}`)
      total = 0
    }
    return total > 0 ? { name, done, total } : null
  }
  return null
}

// Everything both drawings show: this session's entry, the other active
// entries beside it, the gate hooks/gate.js is holding, the context count and
// the plan's ledger; the neighbours and the plan file are read again only when
// their mtimeMs or size changes. The neighbours are read whether or not the
// Pane is up, because the band's flag needs them.
async function look($: EngineInterface, cache: Cache, logged: Logged): Promise<Seen> {
  const id = await $.session.id()
  if (!SESSION_ID.test(id)) return blank(id)
  const found = await findEntry($, id)
  if (!found || !isActive(found.entry)) return blank(id)
  const entry = found.entry as Entry

  const others: Other[] = []
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
    if (other && isActive(other)) others.push({ id: file.name.slice(0, -5), entry: other })
  }

  let pending: Pending | null = null
  let pendingFile: string | null = null
  const dir = taskDir(found.root, entry)
  if (dir && (await $.fs.exists(dir))) {
    const name = pendingName((await $.fs.list(dir)).map((f) => f.name), String(entry.stage))
    if (name) {
      pendingFile = `${dir}/${name}`
      pending = parsePending(String(await $.fs.read(pendingFile)), Date.now())
      if (!pending) pendingFile = null
    }
  }

  const context = await contextOf($, logged)
  const plan = await planOf($, found.root, entry, cache, logged)
  return { id, entry, others, pending, pendingFile, context, plan }
}

type State = {
  seen: Seen
  print: string
  // Why the pane up now is the mod's, and so when it is the mod's to close: 'task' closes with the task, 'gate' with its gate.
  mine: false | 'task' | 'gate'
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
    const next = await look($, state.cache, state.logged)
    const was = state.seen.pendingFile
    const had = state.seen.entry
    // The minute is in the key so the band's minutes and the neighbours' ages move while nothing else does.
    const minute = next.entry ? Math.floor((await $.clock.now()) / 60000) : 0
    const now = JSON.stringify([next.entry, next.others, next.pending && next.pending.questions, next.pendingFile, next.context, next.plan, minute])
    // Asked here, after `look`: /fankeel-pane may have opened or closed the pane while it read files.
    // A task appears: the pane opens, once; a pane the user then closes stays closed until a gate comes. No toast: the band shows the task.
    if (!had && next.entry && !(await isOpen($))) {
      await $.ui.open({ id: PANE, title: 'fankeel' })
      state.mine = 'task'
    }
    if (next.pendingFile && next.pendingFile !== was && !(await isOpen($))) {
      const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
      // Its pane either way, placed now or when the terminal widens.
      state.mine = 'gate'
      if (!opened.isPlaced) $.ui.toast('fankeel：有一個 gate 在等。/fankeel-pane 開面板，或在終端回答')
    }
    if (!next.pendingFile && was && state.mine === 'gate') {
      await $.ui.close({ id: PANE })
      state.mine = false
    }
    if (had && !next.entry && state.mine) {
      if (await isOpen($)) await $.ui.close({ id: PANE })
      state.mine = false
    }
    // After the open and close: a rejected one leaves `seen` as it was, so the next tick sees the gate as new.
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
  const state: State = { seen: blank(''), print: '', mine: false, busy: false, cache: new Map(), logged: { context: '', plan: '' } }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：等待中的 gate、context、plan 進度、notes、其他 session 與碰過的檔案' })
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
    const asked = seen.pending ? seen.pending.questions[0] : null
    const gate = seen.pending ? String((asked && asked.question) ?? '') : null
    // 5: the cells the engine keeps at the band's right end, where no surface has measured the body.
    const cols = Math.max(20, props.bodyColumns ?? (e.viewport?.columns ?? 85) - 5)
    const rows = bandRows(seen.entry, seen.others, gate, cols, Date.now(), width, cut)
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
    // The gate is drawn whole and the Pane scrolls over it; the status blocks take the rows it leaves.
    const gate = pending && pendingFile ? gateRows(pending, cols, width) : []
    const status = statusRows(seen.id, seen.entry, seen.others, seen.context, seen.plan, cols, room - gate.length - (gate.length ? 1 : 0), Date.now())
    const stage = stageColor(String(seen.entry?.stage ?? ''))
    const tones: Record<string, string | undefined> = { head: stage, plain: undefined, text: TITLE, dim: WHERE, amber: GUARD, clash: FLAG, hollow: HOLLOW }
    const gap = () => h(Text, {}, ' ')
    const piece = (seg: StatusSeg) => h(Text, { color: tones[seg.tone], bold: seg.bold, wrap: 'truncate-end' }, seg.text)

    const drawn = [
      ...gate.map((row) => {
        if (row.press !== undefined && pending && pendingFile) {
          return h(Button, {
            key: `gate:${row.hotkey}`,
            hotkey: row.hotkey,
            plain: true,
            onPress: () => answer($, pending, pendingFile, row.press === '' ? HANDOFF : answerText(pending, row.press as string)),
          }, row.text)
        }
        if (row.badge) return h(Text, { backgroundColor: GUARD, color: INK, bold: true }, ` ${row.text} `)
        return h(Text, { bold: row.bold, color: row.dim ? WHERE : undefined, wrap: 'truncate-end' }, row.text)
      }),
      ...(gate.length && status.length ? [gap()] : []),
      ...status.map((row) => (row.segs.length === 0 ? gap() : row.segs.length === 1 ? piece(row.segs[0]) : h(Box, { flexDirection: 'row', gap: 1 }, ...row.segs.map(piece)))),
    ]
    return h(Box, { flexDirection: 'column' }, ...drawn)
  })
}
