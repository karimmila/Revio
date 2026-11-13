/**
 * Agent settings a repository carries that can run commands on this Mac when a chat starts in it:
 * hooks, MCP servers, helper commands, environment and permission overrides. Before the first
 * Claude chat in such a repository the person chooses whether to trust it; the answer is kept for
 * that exact content, so an edit asks again.
 */
export type AgentProjectConfigItemKind =
  | 'hook'
  | 'mcp-server'
  | 'command'
  | 'environment'
  | 'permissions'
  | 'plugins'

export type AgentProjectConfigItem = {
  kind: AgentProjectConfigItemKind
  /** The hook event, server name, setting key or variable name. */
  name: string
  /** The command it runs, when the file names one. */
  detail?: string
  /** The file it was read from, relative to the workspace. */
  file: string
}

/** `trust` loads the repository's settings; `user-only` starts chats with the person's own only. */
export type AgentProjectConfigDecision = 'trust' | 'user-only'

/** What the prompt sends back: a decision, or `dismissed` when it closed with no button pressed. */
export type AgentProjectConfigAnswer = AgentProjectConfigDecision | 'dismissed'

export type AgentProjectConfigTrustRequest = {
  requestId: string
  repoName: string
  items: AgentProjectConfigItem[]
}

export const AGENT_PROJECT_CONFIG_ASK_CHANNEL = 'agentProjectConfig:ask'
export const AGENT_PROJECT_CONFIG_ANSWER_CHANNEL = 'agentProjectConfig:answer'
export const AGENT_PROJECT_CONFIG_DECISION_CHANNEL = 'agentProjectConfig:decision'
export const AGENT_PROJECT_CONFIG_FORGET_CHANNEL = 'agentProjectConfig:forget'
