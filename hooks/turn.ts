// Whether the main session's turn is running, from turn.start to turn.complete: pane.ts sets it, compact.ts owns the one turn.complete that clears it.
export const turn = { running: false }
