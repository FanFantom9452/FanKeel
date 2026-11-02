import type { Register, EngineInterface } from 'claude-code'
import { register as compact, parentOf } from './compact.ts'
import { register as pane } from './pane.ts'

// hooks/brief.js reads this record (hooks/brief.js spawnRecord): a subagent has
// neither transcript nor meta file while its SubagentStart hook runs, and the
// mod sees what the hook cannot. Same name rule on both sides.
const SPAWN_ID = /^[\w.-]+$/
const PROMPT_MAX = 200

// hooks/dispatch-gate.js opens every ask with these words (its `head`, :121);
// tests/mod-decider.test.js reads the hook's source for them.
export const GATE_PREFIX = 'fankeel: this is Agent call '

type Verdict = { decision: string; reason?: string; decider?: string; [k: string]: unknown }

// A dispatch-gate ask is the person's to answer, never the auto-mode
// classifier's (CC 2.1.304 decider "person"): with nobody to ask, the engine
// refuses it with the hook's reason. Every other verdict passes as it came.
export function personDecides(out: Verdict): Verdict {
  if (!out || out.decision !== 'ask' || typeof out.reason !== 'string' || !out.reason.startsWith(GATE_PREFIX)) return out
  const answer: Verdict = { ...out, decider: 'person' }
  return answer
}

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

  // The classic PreToolUse hook (hooks/dispatch-gate.js) has already asked inside next(e);
  // this only names who may answer that ask.
  on('tool.check', { tool: 'Agent' }, async ($, e, next) => {
    const out = await next(e)
    return personDecides(out as unknown as Verdict) as unknown as typeof out
  })

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
