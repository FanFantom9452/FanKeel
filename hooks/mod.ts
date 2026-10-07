import type { Register } from 'claude-code'
import { register as compact } from './compact.ts'

export const register: Register = (on) => {
  compact(on)
}
