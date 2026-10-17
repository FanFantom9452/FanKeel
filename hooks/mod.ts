import type { Register, EngineInterface } from 'claude-code'
import { register as compact, parentOf } from './compact.ts'
import { register as pane } from './pane.ts'

// hooks/brief.js reads this record (hooks/brief.js spawnRecord): a subagent has
// neither transcript nor meta file while its SubagentStart hook runs, and the
// mod sees what the hook cannot. Same name rule on both sides.
const SPAWN_ID = /^[\w.-]+$/
const PROMPT_MAX = 200

// The registry root the way hooks/pane.ts findEntry finds it, written again: the
// engine follows $ only into a function of this file. The nearest ancestor of the
// session's root that holds this session's registry file; null where there is none.
async function spawnRoot($: EngineInterface): Promise<string | null> {
  const id = await $.session.id()
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    if (await $.fs.exists(`${root}/.fankeel/sessions/${id}.json`)) return root
    dir = parentOf(dir)
  }
  return null
}

export const register: Register = (on, options) => {
  compact(on, options)
  pane(on, options)

  // A write that cannot happen is said once; the spawn goes on either way.
  let said = false
  on('agent.spawn', async ($, e, next) => {
    const out = await next(e)
    const agentId = out.agentId
    if (!agentId || !SPAWN_ID.test(agentId)) return out
    try {
      const root = await spawnRoot($)
      if (!root) return out
      const first = String(e.prompt ?? '').split(/\r?\n/, 1)[0]
      const record = {
        prompt: [...first].slice(0, PROMPT_MAX).join(''),
        subagentType: e.subagentType ?? '',
        parentAgentId: e.parentAgentId ?? '',
        at: new Date().toISOString(),
      }
      await $.fs.write(`${root}/.fankeel/build/spawn/${agentId}.json`, JSON.stringify(record))
    } catch (err) {
      if (!said) {
        said = true
        $.ui.log(`fankeel spawn: record of ${agentId} not written, ${String(err)}`, { to: 'debug' })
      }
    }
    return out
  })
}
