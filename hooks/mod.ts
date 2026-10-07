import type { Register } from 'claude-code'
import { register as compact } from './compact.ts'
import { register as awaitTitle } from './await-title.ts'

export const register: Register = (on) => {
  compact(on)
  awaitTitle(on)
}
