import type { Register, EngineInterface } from 'claude-code'

// Compacts the main conversation once its context reaches the profile's
// compact.at (HARD where nothing sets one, never when it is off), but only in a
// session that owns an active fankeel task: the user's own autoCompactEnabled
// is false, and other sessions keep that choice.
// The engine runs this module; it cannot require lib/, so HARD is written
// again here and tests/compact.test.js pins it to lib/context.js HARD.
export const HARD = 450000

// lib/registry.js SESSION_ID: the registry file is named by this id.
export const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/

type Entry = { project?: unknown; configDir?: unknown; task?: unknown; stage?: unknown; class?: unknown; active?: unknown }

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
    '- the design.md and context.md paths under .fankeel/build/, when the conversation named them',
    `- the plugin scripts live under ${pluginRoot}/scripts`,
  ].join('\n')
}

// The registry root is the nearest ancestor holding .fankeel/sessions
// (lib/registry.js findStateRoot); looking for this session's own file there
// also skips a machine-wide registry that does not hold it.
async function findEntry($: EngineInterface, id: string): Promise<{ entry: Entry; root: string } | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    const file = `${root}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      try {
        return { entry: JSON.parse(String(await $.fs.read(file))) as Entry, root }
      } catch (err) {
        $.ui.log(`fankeel compact: unreadable session file ${file}: ${err}`, { to: 'debug' })
        return null
      }
    }
    dir = parentOf(dir)
  }
  return null
}

// lib/profile.js KEYS['compact.at'] values; anything else in a file is read as absent.
const COMPACT_AT = /^(350000|450000|600000|off)$/

async function profileAt($: EngineInterface, file: string): Promise<string | null> {
  try {
    if (!(await $.fs.exists(file))) return null
    const v = (JSON.parse(String(await $.fs.read(file))) as Record<string, unknown>)['compact.at']
    // lib/profile.js parseValue reads String(raw), so a hand-written number counts.
    const at = typeof v === 'string' || typeof v === 'number' ? String(v).trim().toLowerCase() : ''
    return COMPACT_AT.test(at) ? at : null
  } catch (err) {
    $.ui.log(`fankeel compact: unreadable profile ${file}: ${err}`, { to: 'debug' })
    return null
  }
}

// lib/docs.js projectRootsFor: the first segment of the entry's project, when
// that is a directory under the registry root; otherwise the root itself.
async function projectRootOf($: EngineInterface, root: string, project: unknown): Promise<string> {
  if (typeof project !== 'string') return root
  const p = project.replace(/\\/g, '/').replace(/^\.\//, '')
  if (p.startsWith('/') || p.includes('..')) return root
  const head = p.split('/')[0]
  if (!head) return root
  try {
    return (await $.fs.stat(`${root}/${head}`)).kind === 'dir' ? `${root}/${head}` : root
  } catch {
    return root
  }
}

// lib/profile.js: the project file under the entry's project root, then the
// machine file under the entry's configDir.
async function threshold($: EngineInterface, found: { entry: Entry; root: string } | null): Promise<number> {
  const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
  if (Number.isFinite(raw) && raw > 0) return raw
  if (found) {
    const { entry, root } = found
    const project = await projectRootOf($, root, entry.project)
    const machine = typeof entry.configDir === 'string' && entry.configDir ? `${entry.configDir.replace(/[\\/]+$/, '')}/fankeel/profile.json` : null
    const at = (await profileAt($, `${project}/.fankeel/profile.json`)) ?? (machine ? await profileAt($, machine) : null)
    if (at === 'off') return Infinity
    if (at) return Number(at)
  }
  return HARD
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
      const id = await $.session.id()
      if (!SESSION_ID.test(id)) return out
      const found = await findEntry($, id)
      const at = await threshold($, found)
      if (typeof context.tokens !== 'number' || context.tokens < at) return out
      if (!found || !isActive(found.entry)) return out
      const entry = found.entry
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
