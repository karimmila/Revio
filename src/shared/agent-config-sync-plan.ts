import type { AgentConfigItem, SyncAgent, SyncKind } from './agent-config-sync-types'

type Side = Map<string, string>

/**
 * Joins what each agent has (name → content fingerprint) into one row per item, so the page can
 * offer "Copy to" for missing items and a confirmed overwrite for ones that differ.
 */
export function planAgentConfigSync(kind: SyncKind, claude: Side, codex: Side): AgentConfigItem[] {
  const names = [...new Set([...claude.keys(), ...codex.keys()])].sort()
  return names.map((name) => {
    const agents: SyncAgent[] = []
    if (claude.has(name)) {
      agents.push('claude')
    }
    if (codex.has(name)) {
      agents.push('codex')
    }
    return {
      kind,
      name,
      agents,
      same: agents.length === 2 ? claude.get(name) === codex.get(name) : true
    }
  })
}

/** Skill folder and command file names must stay plain names inside their folder. */
export function isSafeConfigName(name: string): boolean {
  return /^[\w][\w.-]*$/.test(name) && !name.includes('..')
}
