// The background shells half of the fankeel Pane, pure, so tests/pane-shell.test.js
// runs it under plain node. hooks/pane.ts records a shell when a Bash or
// PowerShell call sent to the background returns its `backgroundTaskId`, and
// settles each running one against the tail of
// <temp>/claude/<slug>/<session>/tasks/<id>.output: Claude Code ends that file
// with `[exited with code N]`, sometimes with one more line after it. No such
// line is a shell still running. Design: docs/90-agent/plans/2026-10-21-station-focus-design.md section 5.

// `at` is when the observer saw the call return; `end` when a tick first saw it ended, null while it runs.
export type Shell = { id: string; command: string; at: number; end: number | null; code: number | null }

// Characters kept from the end of an output file: the marker and the note after it fit.
export const TAIL = 256
// How long an output file may be missing before its shell counts as ended: a tick can look before Claude Code made it.
export const GRACE_MS = 5000
// How long an ended shell stays listed after it ended.
export const KEEP_MS = 60 * 60000
// Running shells first, then at most ENDED_ROWS ended ones, at most SHELL_ROWS in all.
const ENDED_ROWS = 2
const SHELL_ROWS = 3
// The most shells held in memory: the newest.
const REMEMBERED = 20

// The last exit line wins: a command can print the words itself before Claude Code writes the real one.
export function parseTail(tail: string): { ended: boolean; code: number | null } {
  const marks = [...tail.matchAll(/\[exited with code (-?\d+)\]/g)]
  if (marks.length) return { ended: true, code: Number(marks[marks.length - 1][1]) }
  return /\[killed\]/.test(tail) ? { ended: true, code: null } : { ended: false, code: null }
}

// A running shell read against its output's tail, null where the file is not there: ended now with the
// code the tail names, ended with no code once the file has been missing past GRACE_MS, else unchanged.
export function settle(shell: Shell, tail: string | null, now: number): Shell {
  if (shell.end !== null) return shell
  if (tail === null) return now - shell.at < GRACE_MS ? shell : { ...shell, end: now, code: null }
  const got = parseTail(tail)
  return got.ended ? { ...shell, end: now, code: got.code } : shell
}

export function cutShells(list: Shell[], now: number): Shell[] {
  const running = list.filter((s) => s.end === null).sort((a, b) => b.at - a.at)
  const ended = list
    .filter((s) => s.end !== null && now - s.end < KEEP_MS)
    .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
    .slice(0, ENDED_ROWS)
  return [...running, ...ended].slice(0, SHELL_ROWS)
}

// A shell recorded again under the same id replaces the old one.
export function remember(list: Shell[], shell: Shell): Shell[] {
  return [...list.filter((s) => s.id !== shell.id), shell].slice(-REMEMBERED)
}

export function commandLine(command: string): string {
  return command.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim()
}
