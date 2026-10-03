import type { Register, EngineInterface } from 'claude-code'

// 一次性量測 mod（docs/90-agent/plans/2026-10-03-mod-probe-design.md）。
// 每次 hook 觸發寫一個單行 JSON 記錄檔；$.fs.write 只能整檔寫入，所以一事件一檔，
// 檔名依時間排序就是事件順序。共三處改寫：prompt.compose 對每個系統提示尾端加標記段，
// agent.spawn 與 turn.step 只動帶 mod-probe 標記的派遣。
const LOG = 'F:/ymlab/fankeel/.fankeel/build/task-20261003T060232/probe2/records'
const EFFORT = /MOD-PROBE-EFFORT=(low|medium|high|xhigh)/

let nonce = ''
const effortOf = new Map<string, string | null>()
let probedTurn: string | undefined

// 啟用與熱重載都會讓 session.start 再跑一次（d.ts:4057），模組變數也會清空；
// nonce 存在 $.store 的 'probe.nonce3'，沿用舊值才不會中途換號（換新鍵是為了讓主 session 沒看過新值）。
async function getNonce($: EngineInterface): Promise<string> {
  if (nonce) return nonce
  const kept = await $.store.get('probe.nonce3')
  if (typeof kept === 'string' && kept) {
    nonce = kept
    return nonce
  }
  const fresh = crypto.randomUUID()
  await $.store.set('probe.nonce3', fresh)
  nonce = fresh
  return nonce
}

function suffix(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0')
}

// 寫失敗不讓 hook 失敗：hook 一失敗就被跳過，連帶丟掉它的改寫。
async function record($: EngineInterface, event: string, fields: Record<string, unknown>): Promise<void> {
  const at = Date.now()
  const name = `${String(at).padStart(13, '0')}-${event}-${suffix()}.json`
  try {
    await $.fs.write(`${LOG}/${name}`, JSON.stringify({ event, at, ...fields }) + '\n')
  } catch (err) {
    $.ui.log(`fankeel-mod-probe: ${event} record not written: ${String(err)}`)
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((b: { type?: string; text?: string }) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
    .join('')
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const n = await getNonce($)
    await record($, 'session.start', { nonce: n, isInteractive: e.isInteractive })
    return next(e)
  })

  // 改寫一：系統提示尾端加一段固定的被動標記，scope 為 session，放在所有 shared 之後。
  on('prompt.compose', async ($, e, next) => {
    try {
      const n = await getNonce($)
      await record($, 'prompt.compose', {
        model: e.model,
        promptModel: e.promptModel,
        traits: e.traits,
        tools: e.tools,
        surfaces: e.surfaces,
      })
      const out = await next(e)
      const idsOf = (list: readonly { id: string; scope: string; text: string }[]) =>
        list.map((s) => ({ id: s.id, scope: s.scope, len: s.text.length }))
      // shared 段必須排在所有 session 段之前，所以第二個標記插在第一個 session 段前面。
      const firstSession = out.sections.findIndex((s) => s.scope === 'session')
      const at = firstSession === -1 ? out.sections.length : firstSession
      const shared = { id: 'fankeel-mod-probe:marker-shared', text: `MOD-PROBE-COMPOSE-SHARED-${n}：量測標記，不需理會。`, scope: 'shared' as const }
      const sections = [
        ...out.sections.slice(0, at),
        shared,
        ...out.sections.slice(at),
        { id: 'fankeel-mod-probe:marker', text: `MOD-PROBE-COMPOSE-${n}：量測標記，不需理會。`, scope: 'session' as const },
      ]
      await record($, 'prompt.compose.after', {
        sectionsLengthAfterNext: out.sections.length,
        lastIdAfterNext: out.sections.length ? out.sections[out.sections.length - 1].id : null,
        sectionsLengthWithMarker: sections.length,
        idsAfterNext: idsOf(out.sections),
        idsReturned: idsOf(sections),
        texts: sections.map((s) => s.text.slice(0, 40)),
      })
      $.ui.log(`fankeel-mod-probe compose returned ids=${sections.map((s) => s.id).join(',')}`, { to: 'debug' })
      return { ...out, sections }
    } catch (err) {
      await record($, 'prompt.compose.error', {
        errName: err instanceof Error ? err.name : typeof err,
        errMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  })

  // 純旁路：只記 next 之後的結果，原樣回傳。
  on('prompt.section', async ($, e, next) => {
    const out = await next(e)
    await record($, 'prompt.section', {
      name: e.name,
      textLengthBefore: e.text?.length ?? null,
      textLengthAfter: out.text?.length ?? null,
      head: (out.text ?? '').slice(0, 60),
    })
    return out
  })

  // 改寫二：只對 description 含 "mod-probe b" 的派遣，在 prompt 尾端加一行。
  // 加在尾端，因為 hooks/brief.js:95 的 stageOfPrompt 靠 prompt 的第一個字判斷站名。
  on('agent.spawn', async ($, e, next) => {
    const n = await getNonce($)
    const isB = e.description.includes('mod-probe b')
    const prompt = isB ? `${e.prompt}\nMOD-PROBE-SPAWN-${n}` : e.prompt
    const startedAt = Date.now()
    const res = await next(isB ? { ...e, prompt } : e)
    await record($, 'agent.spawn', {
      startedAt,
      tool_use_id: e.tool_use_id,
      description: e.description,
      subagentType: e.subagentType,
      parentAgentId: e.parentAgentId ?? null,
      promptLengthBefore: e.prompt.length,
      promptLengthAfter: prompt.length,
      agentId: res.agentId ?? null,
      model: res.model ?? null,
      deny: res.deny ?? null,
    })
    return res
  })

  // 改寫三：子代理的請求，若它第一則 assistant 之前的 user 列帶 MOD-PROBE-EFFORT=<level>，
  // 就把 effort 改成該等級。串流事件，只能寫成 async function*（reference.md:28-30）。
  on('turn.step', async function* ($, e, next) {
    let effort = e.effort
    let note: string | null = null
    if (e.agentId !== undefined) {
      let level = effortOf.get(e.agentId)
      if (level === undefined) {
        const found = await $.session.messages({ agentId: e.agentId })
        if (!Array.isArray(found)) {
          note = `messages denied: ${String((found as { deny?: string }).deny)}`
        } else {
          const head: string[] = []
          for (const m of found) {
            if (m.role === 'assistant') break
            head.push(m.text)
          }
          if (head.length) {
            const hit = EFFORT.exec(head.join('\n'))
            level = hit ? hit[1] : null
            effortOf.set(e.agentId, level)
          }
        }
      }
      if (level) effort = level as typeof e.effort
    }
    // 每個 turn 只在主 loop 第一步探一次：$.prompt.compose() 走每個外掛的 compose hook，
    // 只會重入 prompt.compose，不會重入 turn.step。任何失敗只記錄，不影響 step。
    if (e.agentId === undefined && e.index === 0 && probedTurn !== e.turnId) {
      probedTurn = e.turnId
      try {
        const n = await getNonce($)
        const final = await $.prompt.compose()
        const secs = final.sections
        await record($, 'compose.final', {
          ids: secs.map((s) => ({ id: s.id, scope: s.scope, len: s.text.length })),
          hasSession: secs.some((s) => s.text.includes(`MOD-PROBE-COMPOSE-${n}`)),
          hasShared: secs.some((s) => s.text.includes(`MOD-PROBE-COMPOSE-SHARED-${n}`)),
        })
      } catch (err) {
        await record($, 'compose.final', { error: err instanceof Error ? err.message : String(err) })
      }
    }
    const result = yield* next(effort === e.effort ? e : { ...e, effort })
    await record($, 'turn.step', {
      agentId: e.agentId ?? null,
      index: e.index,
      model: e.model,
      effortBefore: e.effort ?? null,
      effortSent: effort ?? null,
      outputTokens: result && result.usage ? result.usage.output_tokens : null,
      note,
    })
    return result
  })

  on('classic.SubagentStart', async ($, e, next) => {
    await record($, 'classic.SubagentStart', { agent_id: e.agent_id, agent_type: e.agent_type })
    return next(e)
  })

  // 只記 hook-context 列：fankeel 的 command hooks（inject.js、brief.js）的輸出從這裡進來。
  on('session.append', { door: 'hook-context' }, async ($, e, next) => {
    const text = textOf(e.message.content)
    await record($, 'session.append', {
      agentId: e.agentId ?? null,
      origin: e.origin,
      head: text.slice(0, 80),
      hasFankeel: text.includes('FANKEEL'),
    })
    return next(e)
  })
}
