import type { Register } from 'claude-code'
import { register as compact } from './compact.ts'
import { register as pane } from './pane.ts'

export const register: Register = (on, options) => {
  compact(on, options)
  pane(on, options)
}
