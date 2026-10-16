// The Pane's agent tree: Claude Code's own files about this session's
// subagents in, a tree out. <configDir>/projects/<slug>/<session>/subagents/
// holds agent-<id>.meta.json (agentType, description, parentAgentId) from the
// dispatch on, and agent-<id>.prefix.json (state.model, state.effortValue)
// from the agent's first request; when one stopped is in
// .fankeel/build/agents-<session>.json (lib/agentends.js). No engine call
// here, so tests/pane-agents.test.js runs it under plain node.

export type AgentFile = { id: string; at: number; meta: Record<string, unknown> | null; prefix: Record<string, unknown> | null }
export type AgentNode = { id: string; title: string; type: string; model: string; effort: string; at: number; end: number | null; kids: AgentNode[] }

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// The prefix hooks/title.js opens a description with: `sonnet 5.5 · medium: `.
const TITLED = /^([a-z]+(?: [\d.]+)?) · ([a-z]+): ([\s\S]*)$/

// A model id as the title hook writes it: claude-sonnet-5-5 is sonnet 5.5; a
// date and a context suffix such as [1m] are dropped; anything else stays as it is.
export function modelAlias(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[[^\]]*\])?$/.exec(id)
  if (!m) return id
  return m[3] ? `${m[1]} ${m[2]}.${m[3]}` : `${m[1]} ${m[2]}`
}

// Every subagent dispatched at or after `since`, hung under its parentAgentId;
// one whose parent is not in the list is a root. The model is the prefix
// file's, else the title's, else the meta's, else ?; the effort the prefix
// file's, else the title's, else ?. Each list runs first, then the newest.
export function agentTree(files: AgentFile[], ended: Record<string, number>, since: number): AgentNode[] {
  const nodes = new Map<string, { node: AgentNode; parent: string }>()
  for (const f of files) {
    if (!f.meta || !(f.at >= since)) continue
    const description = str(f.meta.description)
    const titled = TITLED.exec(description)
    const state = record(record(f.prefix).state)
    const model = str(state.model) ? modelAlias(str(state.model)) : titled ? titled[1] : str(f.meta.model) || '?'
    const effort = str(state.effortValue) || (titled ? titled[2] : '') || '?'
    const end = typeof ended[f.id] === 'number' && Number.isFinite(ended[f.id]) ? ended[f.id] : null
    const node: AgentNode = { id: f.id, title: titled ? titled[3] : description, type: str(f.meta.agentType), model, effort, at: f.at, end, kids: [] }
    nodes.set(f.id, { node, parent: str(f.meta.parentAgentId) })
  }
  const roots: AgentNode[] = []
  for (const { node, parent } of nodes.values()) {
    const up = parent ? nodes.get(parent) : undefined
    if (up) up.node.kids.push(node)
    else roots.push(node)
  }
  const order = (list: AgentNode[]): AgentNode[] => {
    list.sort((a, b) => ((a.end === null) !== (b.end === null) ? (a.end === null ? -1 : 1) : b.at - a.at))
    for (const n of list) order(n.kids)
    return list
  }
  return order(roots)
}
