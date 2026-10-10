// The status half of the fankeel Pane: a registry entry in, rows out.
// No engine call here, so tests/pane-status.test.js runs it under plain node.

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
export type Row = { block: string; text: string; dim?: boolean; bold?: boolean; warn?: boolean }

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

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

// At most `max` lines of `cols` cells; the last one is cut when more remains.
function wrap(s: string, cols: number, max: number): string[] {
  const lines: string[] = []
  let rest = s
  while (rest && lines.length < max) {
    if (lines.length === max - 1) {
      lines.push(cut(rest, cols))
      break
    }
    let line = ''
    for (const ch of rest) {
      if (width(line + ch) > cols) break
      line += ch
    }
    lines.push(line)
    rest = rest.slice(line.length)
  }
  return lines
}

const minutes = (ms: number): string => `${Math.round(ms / 60000)}m`

function age(updated: unknown, now: number): string {
  const at = Date.parse(str(updated))
  if (!Number.isFinite(at)) return '?'
  const min = Math.max(0, Math.round((now - at) / 60000))
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

// Dropped in this order when the rows do not fit; head, route, gate and foot never are.
const DROP = ['cost', 'touched', 'neighbours', 'memory']

export function statusRows(id: string, entry: Entry | null, others: Other[], cols: number, room: number, now: number): Row[] {
  if (!entry) {
    return [
      { block: 'empty', text: cut('這個 session 沒有進行中的任務', cols) },
      { block: 'empty', text: cut('/fankeel 開一個', cols), dim: true },
    ]
  }
  const route = list(entry.route)
  const at = route.indexOf(str(entry.stage))
  const claims = list(entry.claims ?? entry.scope)
  let rows: Row[] = []

  for (const line of wrap(str(entry.task), cols, 2)) rows.push({ block: 'head', text: line, bold: true })
  rows.push({ block: 'head', text: str(entry.class) || 'unknown', dim: true })

  if (route.length) {
    rows.push({ block: 'route', text: `${'●'.repeat(at + 1)}${'○'.repeat(route.length - at - 1)}  ${at + 1} of ${route.length}` })
    rows.push({ block: 'route', text: cut(route.map((s, i) => (i === at ? `[${s}]` : s)).join(' '), cols), dim: true })
  }

  if (str(entry.next)) rows.push({ block: 'memory', text: cut(`next: ${str(entry.next)}`, cols) })
  for (const note of list(entry.notes).slice(0, 5)) rows.push({ block: 'memory', text: cut(`· ${note}`, cols), dim: true })

  if (claims.length) {
    rows.push({ block: 'touched', text: `touched ${claims.length}` })
    for (const file of claims.slice(-3)) rows.push({ block: 'touched', text: tail(file, cols), dim: true })
  }

  const clock = (entry.clock && typeof entry.clock === 'object' ? entry.clock : {}) as Record<string, unknown>
  const waited = (entry.waited && typeof entry.waited === 'object' ? entry.waited : {}) as Record<string, unknown>
  for (const stage of route) {
    const pair = clock[stage]
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') continue
    const held = typeof waited[stage] === 'number' && (waited[stage] as number) > 0 ? `（gate 等 ${minutes(waited[stage] as number)}）` : ''
    rows.push({ block: 'cost', text: cut(`${stage} ${minutes(pair[1] - pair[0])}${held}`, cols), dim: true })
  }

  for (const other of others) {
    const tag = ` @ ${str(other.entry.stage) || '?'} · ${age(other.entry.updated, now)}`
    rows.push({ block: 'neighbours', text: cut(str(other.entry.task) || other.id.slice(0, 8), Math.max(4, cols - width(tag))) + tag })
    const shared = list(other.entry.claims ?? other.entry.scope).find((file) => claims.includes(file))
    if (shared) rows.push({ block: 'neighbours', text: tail(`! 共用 ${shared}`, cols), warn: true })
  }

  rows.push({ block: 'foot', text: cut(`${id.slice(0, 8)} · guard ${str(entry.guard) || 'ask'}`, cols), dim: true })
  rows.push({ block: 'foot', text: cut('/fankeel-pane 開關面板', cols), dim: true })

  for (const block of DROP) {
    if (rows.length <= room) break
    rows = rows.filter((r) => r.block !== block)
  }
  return rows
}
