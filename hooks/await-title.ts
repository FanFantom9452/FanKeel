import type { Register, EngineInterface } from 'claude-code'

// Spike: while an AskUserQuestion gate waits, try to put PREFIX on the session
// title by running the built-in /rename. The mod API has no title reader
// (only the SessionStart/UserPromptSubmit hook output sets one), so the
// current title cannot be prefixed: the spike renames to PREFIX alone, which
// loses the old title. It exists to learn whether $.command.run('rename') is
// accepted at all; read the debug log for each attempt's result.
export const PREFIX = '等你回答 '

export function prefixed(title: string): string {
  return title.startsWith(PREFIX) ? title : PREFIX + title
}

// Not awaited by the hook: $.command.run rejects inside a hook the turn waits
// on and queues until idle otherwise. Three tries, a second apart.
async function renameWithRetry($: EngineInterface): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const names = (await $.command.list()).map((c) => c.name)
      if (!names.includes('rename')) {
        $.ui.log(`fankeel await-title: attempt ${attempt}: no rename command in list`, { to: 'debug' })
      } else {
        const res = await $.command.run({ command: 'rename', args: prefixed('').trim() })
        $.ui.log(`fankeel await-title: attempt ${attempt} done: ${JSON.stringify(res)}`, { to: 'debug' })
        return
      }
    } catch (err) {
      $.ui.log(`fankeel await-title: attempt ${attempt} rejected: ${String(err)}`, { to: 'debug' })
    }
    await $.clock.sleep(1000)
  }
}

export const register: Register = (on) => {
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    // Started before next(e): next(e) resolves only once the person answers,
    // and the title is wanted while the gate waits.
    try {
      void renameWithRetry($).catch((err) => {
        $.ui.log(`fankeel await-title: ${String(err)}`, { to: 'debug' })
      })
    } catch (err) {
      $.ui.log(`fankeel await-title: skipped, ${String(err)}`, { to: 'debug' })
    }
    return next(e)
  })
}
