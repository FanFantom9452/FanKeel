// Reading the pending file hooks/gate.js writes, for the band's gate badge. The
// engine cannot require lib/, so the rules of lib/handoff.js are written again
// here and tests/pane-gate.test.js pins each one to the function it copies.

export type Question = { question: string; header?: string; multiSelect?: boolean; options: { label: string; description?: string }[] }
export type Pending = { questions: Question[]; until: number; at: number | null }

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
