import { ipcRenderer } from 'electron'
import type {
  AgentCredentialName,
  AgentCredentialStatus
} from '../../shared/agent-credentials-types'
import type { McpAgent, McpServerEntry, McpServerSpec } from '../../shared/mcp-inventory-types'
import type { AgentConfigItem, SyncAgent, SyncKind } from '../../shared/agent-config-sync-types'

export type AgentCredentialsApi = {
  status: () => Promise<AgentCredentialStatus>
  /** An empty value removes the secret; the renderer never reads a stored secret back. */
  set: (name: AgentCredentialName, value: string) => Promise<AgentCredentialStatus>
  cursorLogin: () => Promise<void>
  /** User-scope MCP servers of Claude Code and Codex. */
  listMcpServers: () => Promise<McpServerEntry[]>
  addMcpServer: (agent: McpAgent, spec: McpServerSpec) => Promise<McpServerEntry[]>
  /** Skills and slash commands of Claude Code and Codex, for Sync agent configs. */
  listAgentConfigs: () => Promise<AgentConfigItem[]>
  copyAgentConfig: (
    kind: SyncKind,
    name: string,
    to: SyncAgent,
    overwrite: boolean
  ) => Promise<AgentConfigItem[]>
}

export const agentCredentialsApi: AgentCredentialsApi = {
  status: () => ipcRenderer.invoke('agentCredentials:status'),
  set: (name, value) => ipcRenderer.invoke('agentCredentials:set', name, value),
  cursorLogin: () => ipcRenderer.invoke('agentCredentials:cursorLogin'),
  listMcpServers: () => ipcRenderer.invoke('mcpInventory:list'),
  addMcpServer: (agent, spec) => ipcRenderer.invoke('mcpInventory:add', agent, spec),
  listAgentConfigs: () => ipcRenderer.invoke('agentConfigSync:list'),
  copyAgentConfig: (kind, name, to, overwrite) =>
    ipcRenderer.invoke('agentConfigSync:copy', kind, name, to, overwrite)
}
