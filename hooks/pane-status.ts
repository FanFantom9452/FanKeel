// The status half of the fankeel Pane: a registry entry in, rows out.
// No engine call here, so tests/pane-status.test.js runs it under plain node.
// What each block holds is docs/90-agent/judgements/2026-10-11-pane-content.md;
// the stage, the route, `next` and the guard are the band's (hooks/pane-band.ts).

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// A colour by what it means; hooks/pane.ts turns each into a hex of hooks/pane-band.ts.
export type Tone = 'head' | 'plain' | 'text' | 'dim' | 'amber' | 'clash' | 'hollow'
export type Seg = { text: string; tone: Tone; bold?: boolean }
// One drawn row, its segments a cell apart. No segments is the blank row above a block.
export type Row = { block: string; segs: Seg[] }
// The context tokens in play and the count hooks/compact.ts compacts at.
export type Context = { tokens: number; at: number }
// A plan's build ledger: its basename, the tasks recorded complete, the tasks it has.
export type PlanCount = { name: string; done: number; total: number }

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

// Terminal cells: a CJK or full-width character takes two.
export function width(s: string): number {
  let n = 0
  for (const ch of s) n += WIDE.test(ch) ? 2 : 1
  return n
}

// The head of `s` that fits `cols` cells, ending in an ellipsis when cut.
export function cut(s: string, cols: number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > cols - 1) break
    out += ch
  }
  return out + '…'
}

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

function age(updated: unknown, now: number): string {
  const at = Date.parse(str(updated))
  if (!Number.isFinite(at)) return '?'
  const min = Math.max(0, Math.round((now - at) / 60000))
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

// What hooks/compact.ts instructionsFor tells the summary to keep, a word each;
// tests/pane-status.test.js checks every word against that function's text.
export const KEPT = ['task', 'stage', 'plan', 'agent', 'handoff']

// lib/ledger.js HEADER_PREFIX, owns and completed: how many tasks the ledger
// records complete, or null when its first line names another plan.
const LEDGER = '# fankeel build ledger — plan: '
export function ledgerDone(text: string, claim: string): number | null {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== LEDGER + claim) return null
  const done = new Set<number>()
  for (const line of lines) {
    const m = /^Task (\d+): complete\b/.exec(line.trim())
    if (m) done.add(Number(m[1]))
  }
  return done.size
}

// lib/plantasks.js parsePlan: the `## Task N:` headings of a plan, a fenced one not counted.
export function planTotal(text: string): number {
  let total = 0
  let fence = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const f = /^`{3,}/.exec(line)
    if (f) {
      if (fence === 0) fence = f[0].length
      else if (f[0].length >= fence) fence = 0
      continue
    }
    if (!fence && /^##\s+Task\s+\d+:/.test(line)) total += 1
  }
  return total
}

// Dropped in this order when the rows do not fit; the gate (hooks/pane-gate.ts) and foot never are.
const DROP = ['touched', 'neighbours', 'notes', 'plan', 'context']

const thousands = (n: number): string => `${Math.round(n / 1000)}k`

export function statusRows(
  id: string,
  entry: Entry | null,
  others: Other[],
  context: Context | null,
  plan: PlanCount | null,
  cols: number,
  room: number,
  now: number,
): Row[] {
  const one = (block: string, text: string, tone: Tone): Row => ({ block, segs: [{ text, tone }] })
  if (!entry) {
    return [one('empty', cut('這個 session 沒有進行中的任務', cols), 'plain'), one('empty', cut('/fankeel 開一個', cols), 'dim')]
  }
  const head = (block: string, text: string): Row => ({ block, segs: [{ text: cut(text, cols), tone: 'head', bold: true }] })
  const claims = list(entry.claims ?? entry.scope)
  const blocks: Row[][] = []

  if (context) {
    const count = thousands(context.tokens)
    const rest = cut(`· 到 ${thousands(context.at)} 自動 compact`, Math.max(4, cols - width(count) - 1))
    const hot = context.tokens >= context.at
    blocks.push([
      head('context', 'context'),
      { block: 'context', segs: [{ text: count, tone: 'amber', bold: true }, hot ? { text: rest, tone: 'amber', bold: true } : { text: rest, tone: 'dim' }] },
      one('context', cut(`留 ${KEPT.join(' · ')}`, cols), 'dim'),
    ])
  }

  if (plan && plan.total > 0) {
    const done = Math.max(0, Math.min(plan.done, plan.total))
    const count = `tasks ${done} of ${plan.total}`
    const segs: Seg[] = []
    // One dot a task, while the row has the cells for them.
    if (plan.total + 2 + width(count) <= cols) {
      if (done) segs.push({ text: '●'.repeat(done), tone: 'head' })
      if (plan.total - done) segs.push({ text: '○'.repeat(plan.total - done), tone: 'hollow' })
    }
    segs.push({ text: cut(count, cols), tone: 'plain' })
    blocks.push([head('plan', 'plan'), { block: 'plan', segs }, one('plan', cut(plan.name, cols), 'dim')])
  }

  const notes = list(entry.notes).slice(0, 5)
  if (notes.length) blocks.push([head('notes', 'notes'), ...notes.map((note) => one('notes', cut(`· ${note}`, cols), 'text'))])

  if (others.length) {
    const rows: Row[] = [head('neighbours', '其他 session')]
    for (const other of others) {
      const tag = ` @ ${str(other.entry.stage) || '?'} · ${age(other.entry.updated, now)}`
      rows.push(one('neighbours', cut(str(other.entry.task) || other.id.slice(0, 8), Math.max(4, cols - width(tag))) + tag, 'text'))
      const shared = list(other.entry.claims ?? other.entry.scope).find((file) => claims.includes(file))
      // 7: the cells of `⚑ 共用 `.
      if (shared) rows.push({ block: 'neighbours', segs: [{ text: `⚑ 共用 ${tail(shared, Math.max(4, cols - 7))}`, tone: 'clash', bold: true }] })
    }
    blocks.push(rows)
  }

  if (claims.length) {
    blocks.push([head('touched', `touched ${claims.length}`), ...claims.slice(-3).map((file) => one('touched', tail(file, cols), 'dim'))])
  }

  blocks.push([one('foot', cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, cols), 'dim')])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at >= 0) blocks.splice(at, 1)
  }
  return blocks.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block))
}
