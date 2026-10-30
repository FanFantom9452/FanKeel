import type { Limit } from './pane-bar.ts'

// The 5h and 7d readings over a task's life, so a chart can show how they moved:
// hooks/pane.ts appends one row to .fankeel/build/limits/<session>.jsonl each time
// either percentage or the stage changes, and scripts/limits.js and lib/quota.js read it back.
// The source is the engine's own $.session.usage().rateLimits — nothing outside
// fankeel writes or is read here. `account` is the accountUuid of the .claude.json the
// session runs under, when one reads (accountOf); two accounts can share one config dir,
// and lib/quota.js tells them apart by it and by the 7d reset.
export const LIMITS_MAX = 5000

export type LimitRow = {
  at: string
  task: string
  stage: string
  five: number | null
  fiveResets: string | null
  seven: number | null
  sevenResets: string | null
  account?: string
}

function pick(limits: Limit[], kind: string): Limit | null {
  return limits.find((l) => !!l && l.kind === kind && typeof l.percentUsed === 'number' && Number.isFinite(l.percentUsed)) ?? null
}

// The row for this tick and its key, or null when neither window is reported or
// both percentages and the stage equal the ones in `last`, the key written before.
export function limitRow(limits: Limit[], entry: { task?: unknown; stage?: unknown }, now: number, last: string): { row: LimitRow; key: string } | null {
  const five = pick(limits, 'five_hour')
  const seven = pick(limits, 'seven_day')
  if (!five && !seven) return null
  const stage = String(entry.stage ?? '')
  const key = JSON.stringify([five ? five.percentUsed : null, seven ? seven.percentUsed : null, stage])
  if (key === last) return null
  return {
    key,
    row: {
      at: new Date(now).toISOString(),
      task: String(entry.task ?? ''),
      stage,
      five: five ? five.percentUsed : null,
      fiveResets: five?.resetsAt ?? null,
      seven: seven ? seven.percentUsed : null,
      sevenResets: seven?.resetsAt ?? null,
    },
  }
}

// `text` with `row` appended as one JSON line, the oldest dropped past LIMITS_MAX.
export function appendRow(text: string, row: object): string {
  const lines = text.split('\n').filter((l) => l.trim())
  lines.push(JSON.stringify(row))
  return lines.slice(-LIMITS_MAX).join('\n') + '\n'
}

// The account a reading belongs to: `oauthAccount.accountUuid` out of a .claude.json's
// text, and nothing else from it — no email, no name. null when the text is not JSON
// or holds no uuid.
export function accountOf(text: string): string | null {
  try {
    const j = JSON.parse(text)
    const id = j && j.oauthAccount && j.oauthAccount.accountUuid
    return typeof id === 'string' && id ? id : null
  } catch (err) {
    return null
  }
}
