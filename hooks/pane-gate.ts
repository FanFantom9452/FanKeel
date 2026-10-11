// The gate half of the fankeel Pane: the pending file hooks/gate.js writes in,
// rows and the answer file's text out. The engine cannot require lib/, so the
// rules of lib/handoff.js are written again here and tests/pane-gate.test.js
// pins each one to the function it copies.

export type Question = { question: string; header?: string; multiSelect?: boolean; options: { label: string; description?: string }[] }
export type Pending = { questions: Question[]; until: number; at: number | null }
export type GateRow = { block: 'gate'; text: string; dim?: boolean; bold?: boolean; badge?: boolean; press?: string; hotkey?: string }

// lib/handoff.js dirFor.
export function taskDir(root: string, entry: Record<string, unknown>): string | null {
  const started = typeof entry.started === 'string' ? entry.started : ''
  const stamp = started.replace(/[-:]/g, '').slice(0, 15)
  if (!root || !/^\d{8}T\d{6}$/.test(stamp)) return null
  return `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/.fankeel/build/task-${stamp}`
}

// lib/handoff.js fileFor names the first lap `<stage>-pending.json` and the
// n-th `<stage>-<n>-pending.json`; the newest lap is the one being waited on.
export function pendingName(names: string[], stage: string): string | null {
  let best: string | null = null
  let lap = 0
  for (const name of names) {
    if (!name.startsWith(stage) || !name.endsWith('-pending.json')) continue
    const mid = name.slice(stage.length, -'-pending.json'.length)
    if (mid !== '' && !/^-\d+$/.test(mid)) continue
    const n = mid === '' ? 1 : Number(mid.slice(1))
    if (n > lap) {
      lap = n
      best = name
    }
  }
  return best
}

// hooks/gate.js asks pendingPath and answerPath with the same lap, so the
// answer file is the pending file's name with its suffix swapped.
export const answerName = (pending: string): string => pending.replace(/-pending\.json$/, '-answer.md')

// lib/handoff.js readPending: no questions array or an `until` already past is no gate;
// `at` is when the wait began, or null.
export function parsePending(text: string, now: number): Pending | null {
  let got: unknown
  try {
    got = JSON.parse(text)
  } catch {
    return null
  }
  const g = got as { questions?: unknown; until?: unknown; at?: unknown } | null
  if (!g || typeof g !== 'object' || !Array.isArray(g.questions) || !(typeof g.until === 'number' && g.until > now)) return null
  return { questions: g.questions as Question[], until: g.until, at: typeof g.at === 'number' && Number.isFinite(g.at) ? g.at : null }
}

// One single-select question is the shape a row of buttons can answer.
export function simple(pending: Pending): boolean {
  const q = pending.questions[0]
  return pending.questions.length === 1 && !!q && q.multiSelect !== true && Array.isArray(q.options) && q.options.length > 0 && q.options.length <= 4
}

// The page's 「交給終端／手機」, as scripts/station.js writes it.
export const HANDOFF = JSON.stringify({ handoff: 'terminal' }) + '\n'

// The answer file for the one question asked, as scripts/station.js POST /answer
// writes it; null when the gate is not simple or the label is not one it offered.
export function answerText(pending: Pending, label: string): string | null {
  if (!simple(pending)) return null
  const q = pending.questions[0]
  if (!q.options.some((o) => o.label === label)) return null
  return JSON.stringify({ answers: { [q.question]: label } }, null, 2) + '\n'
}

// `s` in lines of at most `cols` cells, every character kept: a line breaks
// where the next character would not fit, and a space there is the break.
function wrap(s: string, cols: number, width: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of s.replace(/\s+/g, ' ').trim()) {
    if (line && width(line + ch) > cols) {
      lines.push(line)
      line = ch === ' ' ? '' : ch
    } else line += ch
  }
  if (line) lines.push(line)
  return lines
}

// The head of `s` that fits `cols` cells, ending in an ellipsis when cut.
function clip(s: string, cols: number, width: (s: string) => number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > cols - 1) break
    out += ch
  }
  return out + '…'
}

// `press` is the label a button answers with; '' is the terminal button.
// `badge` is the header, drawn on a coloured ground. Nothing is dropped for
// lack of rows: the question and every option's description are wrapped
// whole, and a gate taller than the Pane scrolls in it. `width` is
// hooks/pane-status.ts's, passed in so this file imports nothing.
export function gateRows(pending: Pending, cols: number, width: (s: string) => number): GateRow[] {
  const rows: GateRow[] = []
  const q = pending.questions[0]
  // 2: the badge's own space either side.
  rows.push({ block: 'gate', text: clip(`gate · ${q && q.header ? q.header : ''}`, cols - 2, width), bold: true, badge: true })
  if (simple(pending)) {
    for (const line of wrap(String(q.question ?? ''), cols, width)) rows.push({ block: 'gate', text: line, bold: true })
    q.options.forEach((o, i) => {
      rows.push({ block: 'gate', text: clip(o.label, cols - 3, width), press: o.label, hotkey: String(i + 1) })
      const about = typeof o.description === 'string' ? o.description : ''
      for (const line of wrap(about, cols - 3, width)) rows.push({ block: 'gate', text: `   ${line}`, dim: true })
    })
  } else {
    for (const line of wrap(`${pending.questions.length} 題，或有多選：在終端或 station 頁回答`, cols, width)) rows.push({ block: 'gate', text: line, dim: true })
  }
  rows.push({ block: 'gate', text: clip('交給終端', cols - 3, width), press: '', hotkey: 't' })
  rows.push({ block: 'gate', text: clip('ctrl+x tab 進面板，再按數字或 t', cols, width), dim: true })
  return rows
}
