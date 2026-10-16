import type { Register, EngineInterface, UiPressArgument } from 'claude-code'
import { parentOf, isActive, SESSION_ID, thresholdWith } from './compact.ts'
import { statusRows, ledgerDoneIds, planTasks } from './pane-status.ts'
import type { Entry, Other, Context, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow, StatusInput } from './pane-status.ts'
import type { Limit } from './pane-bar.ts'
import { taskDir, pendingName, parsePending } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'
import { agentTree, agentTokens } from './pane-agents.ts'
import type { AgentFile, AgentNode } from './pane-agents.ts'
import { bandRows } from './pane-band.ts'
import type { Seg as BandSeg, BandInput } from './pane-band.ts'
import { bandRow1Svg, bandRow2Svg, paneParts, altOf, SVG_MAX } from './pane-svg.ts'

// The fankeel mod's two drawings: two rows above the prompt for what is always
// wanted, and the Pane for what is looked up. The Pane opens itself while the
// session owns a task; /fankeel-panel toggles it. docs/90-agent/plans/2026-10-12-pane-band-design.md
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
  context: Context | null
  limits: Limit[]
  plan: PlanInfo | null
  // Whether Remote Control is connected, from Claude Code's own session file.
  remote: boolean
  // What probeOf read, or null while FANKEEL_PANE_PROBE is unset.
  probe: string | null
  // This task's subagents as a tree, from Claude Code's subagents files (agentsOf).
  agents: AgentNode[]
  // The station's url from serve.json (stationOf), or null when none is up.
  station: string | null
}

// What a file last parsed to, and the time and size it had then: the tick runs
// four times a second in every session that enabled the mod, and a neighbour's
// registry file or a plan file that has not moved is not read again. The
// session's own registry file, the pending file and the ledger are read every tick.
type Cache = Map<string, { stamp: string; value: unknown }>

const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, context: null, limits: [], plan: null, remote: false, probe: null, agents: [], station: null })

// The last message each silent catch logged: the tick runs four times a second, and a failure that stays is said once.
type Logged = { context: string; plan: string; open: string; registry: string; neighbour: string; gate: string; live: string; remote: string; bandSvg: string; paneSvg: string; agents: string; station: string }

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

// The tokens in play against the count hooks/compact.ts compacts at — its own
// `thresholdWith`, so FANKEEL_COMPACT_AT, the profile's compact.at and HARD are read
// in one place, and `off` is Infinity — and the rate limits the same call
// reports: `five_hour` and `seven_day` are the two drawn.
// No context while the engine has no count; neither when it cannot be asked.
async function contextOf($: EngineInterface, logged: Logged, found: { entry: Entry; root: string }): Promise<{ context: Context | null; limits: Limit[] }> {
  try {
    const usage = await $.session.usage()
    const limits = Array.isArray(usage.rateLimits) ? (usage.rateLimits as Limit[]) : []
    if (typeof usage.context.tokens !== 'number') return { context: null, limits }
    const window = usage.context.window
    const io = {
      compactAt: () => $.env.get('FANKEEL_COMPACT_AT'),
      exists: (path: string) => $.fs.exists(path),
      read: async (path: string) => String(await $.fs.read(path)),
      stat: (path: string) => $.fs.stat(path),
      log: (text: string) => $.ui.log(text, { to: 'debug' }),
    }
    return { context: { tokens: usage.context.tokens, at: await thresholdWith(io, found), ...(typeof window === 'number' && Number.isFinite(window) && window > 0 ? { window } : {}) }, limits }
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

// The config directory this session runs under: the one its entry recorded, else ~/.claude; '' when neither is known.
async function configDirOf($: EngineInterface, entry: Entry): Promise<string> {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  const configDir = typeof entry.configDir === 'string' && entry.configDir ? entry.configDir : home ? `${home}/.claude` : ''
  return configDir.replace(/[\\/]+$/, '')
}

// Whether Remote Control is on for this session: Claude Code writes <configDir>/sessions/<pid>.json with
// the session's `sessionId`, and a `bridgeSessionId` that is a non-empty string while it is connected
// (null once switched off, absent if it never was; measured on 2.1.295). The file for this session is
// found by its sessionId, not by its name. A directory or file that cannot be read counts as not connected.
async function remoteOf($: EngineInterface, entry: Entry, id: string, cache: Cache, logged: Logged): Promise<boolean> {
  try {
    const configDir = await configDirOf($, entry)
    if (!configDir) return false
    const dir = `${configDir}/sessions`
    if (!(await $.fs.exists(dir))) return false
    // Several files can name this session (a dead pid leaves its own behind): the newest one is the truth.
    let newest = -Infinity
    let remote = false
    const listed = new Set<string>()
    for (const file of await $.fs.list(dir)) {
      if (!file.name.endsWith('.json')) continue
      const path = `${dir}/${file.name}`
      listed.add(path)
      const stamp = `${file.mtimeMs}:${file.size}`
      let hit = cache.get(path)
      if (!hit || hit.stamp !== stamp) {
        // A file caught mid-write keeps its last good reading, and is read again next tick.
        const fresh = await readJson($, path)
        if (fresh) {
          hit = { stamp, value: fresh }
          cache.set(path, hit)
        } else hit = { stamp, value: hit ? hit.value : null }
      }
      const got = hit.value as { sessionId?: unknown; bridgeSessionId?: unknown } | null
      if (got && got.sessionId === id && file.mtimeMs >= newest) {
        const on = typeof got.bridgeSessionId === 'string' && got.bridgeSessionId !== ''
        // On an equal mtime connected wins, so the answer does not depend on the listing's order.
        remote = file.mtimeMs === newest ? remote || on : on
        newest = file.mtimeMs
      }
    }
    for (const key of cache.keys()) if (key.startsWith(`${dir}/`) && !listed.has(key)) cache.delete(key)
    logged.remote = ''
    return remote
  } catch (err) {
    logOnce($, logged, 'remote', `fankeel pane: Remote Control state unreadable, ${String(err)}`)
    return false
  }
}

// How long a session with no subagents directory yet waits before projects/ is listed again.
const SUB_RETRY_MS = 10000

// This task's subagents, from Claude Code's own files under
// <configDir>/projects/<slug>/<session>/subagents (hooks/pane-agents.ts) and
// the stops hooks/agent-end.js wrote. The session's directory is found by its
// name under projects/ and kept; a meta, prefix or transcript file is read again only
// when it moved. Anything unreadable is no agents.
async function agentsOf($: EngineInterface, entry: Entry, id: string, root: string, cache: Cache, logged: Logged): Promise<AgentNode[]> {
  try {
    const started = Date.parse(String(entry.started))
    if (!Number.isFinite(started)) return []
    const key = `subagents:${id}`
    const known = cache.get(key)
    let sub = known && typeof known.value === 'string' ? known.value : ''
    if (!sub) {
      if (known && Date.now() - Number(known.stamp) < SUB_RETRY_MS) return []
      const configDir = await configDirOf($, entry)
      const projects = `${configDir}/projects`
      if (configDir && (await $.fs.exists(projects))) {
        for (const dir of await $.fs.list(projects)) {
          const at = `${projects}/${dir.name}/${id}/subagents`
          if (await $.fs.exists(at)) {
            sub = at
            break
          }
        }
      }
      cache.set(key, { stamp: String(Date.now()), value: sub })
      if (!sub) return []
    }
    let listed: Awaited<ReturnType<EngineInterface['fs']['list']>>
    try {
      listed = await $.fs.list(sub)
    } catch (err) {
      // The cached directory is gone: look for it again next tick.
      cache.delete(key)
      throw err
    }
    const stamps = new Map(listed.map((f) => [f.name, `${f.mtimeMs}:${f.size}`]))
    const read = async (name: string): Promise<Record<string, unknown> | null> => {
      const stamp = stamps.get(name)
      if (!stamp) return null
      const path = `${sub}/${name}`
      let hit = cache.get(path)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, value: await readJson($, path) }
        // A file caught mid-write is read again next tick.
        if (hit.value) cache.set(path, hit)
      }
      return (hit.value as Record<string, unknown> | null) ?? null
    }
    // The transcript's token count, kept by its stamp: a running agent's file grows each request.
    const spent = async (name: string): Promise<number | null> => {
      const stamp = stamps.get(name)
      if (!stamp) return null
      const path = `${sub}/${name}`
      const hit = cache.get(path)
      if (hit && hit.stamp === stamp) return typeof hit.value === 'number' ? hit.value : null
      let text: string
      try {
        text = String(await $.fs.read(path))
      } catch {
        // Gone or locked between the listing and the read: no tokens this tick, tried again the next.
        return null
      }
      const tokens = agentTokens(text)
      cache.set(path, { stamp, value: tokens })
      return tokens
    }
    const files: AgentFile[] = []
    for (const f of listed) {
      const m = /^agent-(.+)\.meta\.json$/.exec(f.name)
      if (!m || f.mtimeMs < started) continue
      files.push({ id: m[1], at: f.mtimeMs, meta: await read(f.name), prefix: await read(`agent-${m[1]}.prefix.json`), tokens: await spent(`agent-${m[1]}.jsonl`) })
    }
    const ends = await readJson($, `${root}/.fankeel/build/agents-${id}.json`)
    const ended: Record<string, number> = {}
    if (ends && ends.ended && typeof ends.ended === 'object') {
      for (const [k, v] of Object.entries(ends.ended)) if (typeof v === 'number' && Number.isFinite(v)) ended[k] = v
    }
    logged.agents = ''
    return agentTree(files, ended, started)
  } catch (err) {
    logOnce($, logged, 'agents', `fankeel pane: agents unreadable, ${String(err)}`)
    return []
  }
}

// What a station's url looks like: scripts/station.js binds 127.0.0.1. Anything
// else in serve.json draws no button, since pressing it hands the url to a shell's `start`.
const STATION_URL = /^http:\/\/127\.0\.0\.1:\d{1,5}\/?$/

// The station's url as <configDir>/fankeel/serve.json records it (lib/serve.js),
// or null when there is none. With no entry the config directory is
// CLAUDE_CONFIG_DIR, else ~/.claude.
async function stationOf($: EngineInterface, entry: Entry | null, logged: Logged): Promise<string | null> {
  try {
    const recorded = !!entry && typeof entry.configDir === 'string' && !!entry.configDir
    const configDir = recorded && entry ? await configDirOf($, entry) : ((await $.env.get('CLAUDE_CONFIG_DIR')) || (await configDirOf($, {}))).replace(/[\\/]+$/, '')
    if (!configDir) return null
    const file = `${configDir}/fankeel/serve.json`
    if (!(await $.fs.exists(file))) return null
    const got = await readJson($, file)
    return got && typeof got.url === 'string' && STATION_URL.test(got.url) ? got.url : null
  } catch (err) {
    logOnce($, logged, 'station', `fankeel pane: station record unreadable, ${String(err)}`)
    return null
  }
}

// Opens the station's page in the host's browser: `start` on Windows, else
// `open`, then `xdg-open`. When none of them runs, the url is copied instead,
// and when that fails too a toast says so with the url in it.
async function openStation($: EngineInterface, url: string, surface: UiPressArgument['surface']): Promise<void> {
  const windows = (await $.env.get('OS')) === 'Windows_NT'
  const tries = windows ? [['cmd', '/c', 'start', '', url]] : [['open', url], ['xdg-open', url]]
  for (const argv of tries) {
    try {
      const done = await $.process.run(argv, { timeoutMs: 10000 })
      if (done.exitCode === 0) return
    } catch {
      // `$.process.run` is CLI only: on another engine it rejects, and the next try or the copy follows.
    }
  }
  try {
    if ((await $.ui.copy({ text: url, surface })).isCopied) return
  } catch {
    // Said by the toast below, the same as a copy the surface declined.
  }
  $.ui.toast(`station：開不了瀏覽器，也複製不了網址 ${url}`)
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
  if (!found || !isActive(found.entry)) return { ...blank(id), station: await stationOf($, null, logged) }
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
  const dir = taskDir(found.root, entry)
  if (dir && (await $.fs.exists(dir))) {
    const name = pendingName((await $.fs.list(dir)).map((f) => f.name), String(entry.stage))
    if (name) {
      const pendingFile = `${dir}/${name}`
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
      } else logged.gate = ''
    }
  }

  const { context, limits } = await contextOf($, logged, found)
  const plan = await planOf($, found.root, entry, cache, logged)
  const probe = await probeOf($)
  const remote = await remoteOf($, entry, id, cache, logged)
  const agents = await agentsOf($, entry, id, found.root, cache, logged)
  const station = await stationOf($, entry, logged)
  return { id, entry, others, pending, context, limits, plan, remote, probe, agents, station }
}

type State = {
  seen: Seen
  print: string
  // Whether the pane up now is the mod's, opened for the task, and so the mod's to close when the task ends.
  mine: false | 'task'
  // Whether a task was there the last time the opens and closes for it went through.
  edge: { task: boolean }
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
    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.station, minute, second])
    // The opens and closes have their own memory, `edge`, which moves only when they all went through: a rejected
    // one is met again next tick as the same edge, while `seen` and the redraw below never wait on them.
    try {
      // Asked here, after `look`: /fankeel-panel may have opened or closed the pane while it read files.
      // A task appears: the pane opens, once; a pane the user then closes stays closed. No toast: the band shows the task.
      if (!state.edge.task && next.entry && !(await isOpen($))) {
        await $.ui.open({ id: PANE, title: 'fankeel' })
        state.mine = 'task'
      }
      if (state.edge.task && !next.entry && state.mine) {
        // Not asked whether it is open: a pane registered but not placed (a narrow terminal) is still the mod's to close.
        await $.ui.close({ id: PANE })
        state.mine = false
      }
      state.edge = { task: !!next.entry }
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

export const register: Register = (on) => {
  const state: State = {
    seen: blank(''), print: '', mine: false, edge: { task: false }, bad: 0, busy: false, cache: new Map(),
    logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '', remote: '', bandSvg: '', paneSvg: '', agents: '', station: '' },
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：任務、撞檔、tasks、context、用量額度與 notes' })
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
    const now = Date.now()
    const band: BandInput = {
      entry: seen.entry,
      others: seen.others,
      gateUntil: seen.pending ? seen.pending.until : null,
      gateAt: seen.pending ? (seen.pending.at ?? now) : null,
      context: seen.context,
      limits: seen.limits,
      tasks: plan ? { done: plan.tasks.filter((t) => plan.done.includes(t.n)).length, total: plan.tasks.length } : null,
      remote: seen.remote,
      cols,
      now,
    }
    const rows = bandRows(band)
    if (!rows) return next(e)
    // Claude Desktop draws each row as one Svg, its alt the row as text; every other surface draws the text.
    // A drawing that throws, or comes back empty or over the engine's limit, falls through to the text rows.
    if (e.surface === 'desktop') {
      try {
        const { Box, Svg } = $.ui.resolve(e)
        const sources = rows.map((_, i) => (i === 0 ? bandRow1Svg(band) : bandRow2Svg(band)))
        if (sources.some((source) => !source || source.length > SVG_MAX)) throw new Error('a band row drew empty or over the limit')
        return h(Box, { flexDirection: 'column' }, ...sources.map((source, i) => h(Svg, { source, alt: altOf([rows[i]]) })))
      } catch (err) {
        logOnce($, state.logged, 'bandSvg', `fankeel pane: band Svg not drawn, ${String(err)}`)
      }
    }
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
    // One reading for the whole drawing, so the status block's minutes are of the same moment.
    const now = Date.now()
    const input: StatusInput = {
      id: seen.id,
      entry: seen.entry,
      others: seen.others,
      context: seen.context,
      plan: seen.plan,
      cols,
      room,
      now,
      probe: seen.probe,
      gateAt: seen.pending ? (seen.pending.at ?? now) : null,
      agents: seen.agents,
      station: seen.station,
    }
    const status = statusRows(input)
    const blankRow = () => h(Text, {}, ' ')
    // A row's segments touch: each carries its own colour, and its own space where it wants one.
    const piece = (seg: StatusSeg) => {
      const url = seen.station
      if (seg.press === 'station' && url) return h(Button, { key: 'station', label: seg.text, hotkey: 's', onPress: (press: UiPressArgument) => openStation($, url, press.surface) })
      return h(Text, { color: seg.color, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
    }
    const line = (row: StatusRow) => (row.segs.length === 0 ? blankRow() : h(Box, { flexDirection: 'row' }, ...row.segs.map(piece)))
    // Claude Desktop draws the route, the clash, the tasks and the context as Svg; every other surface draws the text.
    if (e.surface === 'desktop') {
      try {
        const { Svg } = $.ui.resolve(e)
        return h(Box, { flexDirection: 'column' }, ...paneParts(input, status).flatMap((part) => ('rows' in part ? part.rows.map(line) : [h(Svg, part)])))
      } catch (err) {
        logOnce($, state.logged, 'paneSvg', `fankeel pane: Pane Svg not drawn, ${String(err)}`)
      }
    }
    return h(Box, { flexDirection: 'column' }, ...status.map(line))
  })
}
