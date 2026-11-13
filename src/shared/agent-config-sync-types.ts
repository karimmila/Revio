export type SyncAgent = 'claude' | 'codex'
export type SyncKind = 'skill' | 'command'

/** One skill or slash command and where it lives; `same` is false when both copies differ. */
export type AgentConfigItem = {
  kind: SyncKind
  name: string
  agents: SyncAgent[]
  same: boolean
}
