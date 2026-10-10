import type { Register, EngineInterface } from 'claude-code'
import { findEntry, isActive, SESSION_ID } from './compact.ts'
import { statusRows, cut } from './pane-status.ts'
import type { Entry, Other } from './pane-status.ts'
import { taskDir, pendingName, answerName, parsePending, gateRows, answerText, HANDOFF } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'

// The fankeel Pane: this session's task on top of whatever gate is waiting.
// docs/90-agent/plans/2026-10-11-fankeel-pane-design.md. Nothing here runs
// unless the module was enabled, and nothing outside it depends on it.
export const PANE = 'fankeel'
export const COMMAND = 'fankeel-pane'
export const POLL_MS = 250

type Seen = {
  id: string
  entry: Entry | null
  others: Other[]
  pending: Pending | null
  pendingFile: string | null
}

async function readJson($: EngineInterface, file: string): Promise<Entry | null> {
  try {
    const got = JSON.parse(String(await $.fs.read(file)))
    return got && typeof got === 'object' && !Array.isArray(got) ? (got as Entry) : null
  } catch {
    return null
  }
}

// Everything the pane draws, read fresh: this session's entry, the other
// active entries beside it, and the gate hooks/gate.js is holding, if any.
// The neighbours are read only while the pane is placed: this runs every tick
// of every session that enabled the mod.
async function look($: EngineInterface, placed: boolean): Promise<Seen> {
  const id = await $.session.id()
  const none: Seen = { id, entry: null, others: [], pending: null, pendingFile: null }
  if (!SESSION_ID.test(id)) return none
  const found = await findEntry($, id)
  if (!found || !isActive(found.entry)) return none
  const entry = found.entry as Entry

  const others: Other[] = []
  const sessions = `${found.root}/.fankeel/sessions`
  for (const file of placed ? await $.fs.list(sessions) : []) {
    if (!file.name.endsWith('.json') || file.name === `${id}.json`) continue
    const other = await readJson($, `${sessions}/${file.name}`)
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
  return { id, entry, others, pending, pendingFile }
}

export const register: Register = (on) => {
  let seen: Seen = { id: '', entry: null, others: [], pending: null, pendingFile: null }
  let print = ''
  // Whether the pane up now is one the mod opened for a gate, and so it's to close.
  let mine = false
  let busy = false

  // An unplaced pane (narrow terminal) is registered but not drawn: not open.
  const isOpen = async ($: EngineInterface): Promise<boolean> => (await $.ui.panes()).some((pane) => pane.id === PANE && pane.isPlaced)

  async function tick($: EngineInterface): Promise<void> {
    if (busy) return
    busy = true
    try {
      const placed = await isOpen($)
      const next = await look($, placed)
      const was = seen.pendingFile
      const now = JSON.stringify([next.entry, next.others, next.pending && next.pending.questions, next.pendingFile])
      // Asked again here, not `placed`: /fankeel-pane may have opened or closed the pane while `look` read files.
      if (next.pendingFile && next.pendingFile !== was && !(await isOpen($))) {
        const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
        // Its pane either way, placed now or when the terminal widens.
        mine = true
        if (!opened.isPlaced) $.ui.toast('fankeel：有一個 gate 在等。/fankeel-pane 開面板，或在終端回答')
      }
      if (!next.pendingFile && was && mine) {
        await $.ui.close({ id: PANE })
        mine = false
      }
      // After the open and close: a rejected one leaves `seen` as it was, so the next tick sees the gate as new.
      seen = next
      if (now !== print) {
        print = now
        $.ui.invalidate('ui.render')
      }
    } catch (err) {
      $.ui.log(`fankeel pane: tick skipped, ${String(err)}`, { to: 'debug' })
    } finally {
      busy = false
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

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：這個 session 的任務、階段與等待中的 gate' })
    $.clock.every(POLL_MS, () => tick($))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($) => {
    mine = false
    if (await isOpen($)) {
      await $.ui.close({ id: PANE })
      return { text: 'fankeel 面板已關閉。' }
    }
    const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
    await tick($)
    return { text: opened.isPlaced ? 'fankeel 面板已開啟。' : 'fankeel 面板開不了：終端太窄。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const cols = Math.max(20, (e.viewport?.columns ?? 44) - 2)
    const room = Math.max(8, (e.viewport?.rows ?? 24) - 4)
    const pending = seen.pending
    const pendingFile = seen.pendingFile
    // 7: the status rows that never drop (head up to 3, route 2, foot 2).
    const gate = pending && pendingFile ? gateRows(pending, cols, room - 7, cut) : []
    const status = statusRows(seen.id, seen.entry, seen.others, cols, room - gate.length, Date.now())

    const drawn = [
      ...gate.map((row) =>
        row.press === undefined || !pending || !pendingFile
          ? h(Text, { bold: row.bold, dimColor: row.dim, wrap: 'truncate-end' }, row.text)
          : h(Button, {
              key: `gate:${row.hotkey}`,
              hotkey: row.hotkey,
              plain: true,
              onPress: () => answer($, pending, pendingFile, row.press === '' ? HANDOFF : answerText(pending, row.press as string)),
            }, row.text),
      ),
      ...status.map((row) => h(Text, { bold: row.bold, dimColor: row.dim, color: row.warn ? 'yellow' : undefined, wrap: 'truncate-end' }, row.text)),
    ]
    return h(Box, { flexDirection: 'column' }, ...drawn)
  })
}
