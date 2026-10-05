import type { Register, EngineInterface } from 'claude-code'

// Compacts the main conversation once its context reaches HARD, but only in a
// session that owns an active fankeel task: the user's own autoCompactEnabled
// is false, and other sessions keep that choice.
// The engine runs this module; it cannot require lib/, so HARD is written
// again here and tests/compact.test.js pins it to lib/context.js HARD.
export const HARD = 450000

// lib/registry.js SESSION_ID: the registry file is named by this id.
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/

type Entry = { task?: unknown; stage?: unknown; class?: unknown; active?: unknown }

export function parentOf(dir: string): string | null {
  const trimmed = dir.replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return null
  if (cut === 0) return trimmed.length > 1 ? '/' : null
  return trimmed.slice(0, cut)
}

// hooks/inject.js:106-107: active is exactly true, and an entry that only ran
// /fankeel (stage init, no task) is not in the mode yet.
export function isActive(entry: Entry | null): boolean {
  if (!entry || entry.active !== true) return false
  return !(entry.stage === 'init' && !entry.task)
}

export function instructionsFor(id: string, entry: Entry, pluginRoot: string): string {
  return [
    'fankeel: this session is running a fankeel task. The summary must keep, word for word:',
    `- session ${id} (every task.js call needs --session ${id})`,
    `- task: ${String(entry.task)}`,
    `- stage: ${String(entry.stage)}, class: ${String(entry.class ?? 'unknown')}`,
    '- the plan file path, the build group in progress, and every task already recorded complete',
    '- the agentId of every dispatched agent that has not returned yet, and what it was sent to do',
    '- the last handoff and commit file paths named in the conversation',
    `- the plugin scripts live under ${pluginRoot}/scripts`,
  ].join('\n')
}

// The registry root is the nearest ancestor holding .fankeel/sessions
// (lib/registry.js findStateRoot); looking for this session's own file there
// also skips a machine-wide registry that does not hold it.
async function findEntry($: EngineInterface, id: string): Promise<Entry | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const file = `${dir.replace(/[\\/]+$/, '')}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      try {
        return JSON.parse(String(await $.fs.read(file))) as Entry
      } catch (err) {
        $.ui.log(`fankeel compact: unreadable session file ${file}: ${err}`, { to: 'debug' })
        return null
      }
    }
    dir = parentOf(dir)
  }
  return null
}

async function threshold($: EngineInterface): Promise<number> {
  const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
  return Number.isFinite(raw) && raw > 0 ? raw : HARD
}

// Not awaited by the hook: compact rejects while a turn runs, and the turn may
// still count as running until this hook returns. Three tries, a second apart; tests/compact.test.js pins the three.
async function compactWithRetry($: EngineInterface, instructions: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await $.session.compact({ instructions })
      $.ui.log(`fankeel compact: attempt ${attempt} ${res && res.skip ? 'skipped by a hook' : 'done'}`, { to: 'debug' })
      return
    } catch (err) {
      $.ui.log(`fankeel compact: attempt ${attempt} rejected: ${String(err)}`, { to: 'debug' })
      await $.clock.sleep(1000)
    }
  }
}

export const register: Register = (on) => {
  let pending = false
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined || pending) return out
    try {
      const { context } = await $.session.usage()
      const at = await threshold($)
      if (typeof context.tokens !== 'number' || context.tokens < at) return out
      const id = await $.session.id()
      if (!SESSION_ID.test(id)) return out
      const entry = await findEntry($, id)
      if (!entry || !isActive(entry)) return out
      pending = true
      $.ui.log(`fankeel compact: ${context.tokens} tokens >= ${at}, compacting`, { to: 'debug' })
      void compactWithRetry($, instructionsFor(id, entry, $.plugin.root)).finally(() => {
        pending = false
      })
    } catch (err) {
      $.ui.log(`fankeel compact: skipped, ${String(err)}`, { to: 'debug' })
    }
    return out
  })
}
