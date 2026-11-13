import { ipcMain } from 'electron'
import {
  AGENT_CREDENTIAL_NAMES,
  type AgentCredentialName
} from '../../shared/agent-credentials-types'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { agentCredentialStatus, setAgentCredential } from './agent-credentials-store'
import { runCursorAgentLogin } from './cursor-login'

function credentialName(value: unknown): AgentCredentialName {
  const name = AGENT_CREDENTIAL_NAMES.find((candidate) => candidate === value)
  if (!name) {
    throw new Error('Unknown credential.')
  }
  return name
}

export function registerAgentCredentialHandlers(getSettings: () => GlobalSettings): void {
  ipcMain.handle('agentCredentials:status', () => agentCredentialStatus())
  ipcMain.handle('agentCredentials:set', (_event, name: unknown, value: unknown) => {
    setAgentCredential(credentialName(name), typeof value === 'string' ? value : '')
    return agentCredentialStatus()
  })
  ipcMain.handle('agentCredentials:cursorLogin', () => runCursorAgentLogin(getSettings()))
}
