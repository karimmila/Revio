import { app, ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import {
  AGENT_PROJECT_CONFIG_ANSWER_CHANNEL,
  AGENT_PROJECT_CONFIG_ASK_CHANNEL,
  AGENT_PROJECT_CONFIG_DECISION_CHANNEL,
  AGENT_PROJECT_CONFIG_FORGET_CHANNEL,
  type AgentProjectConfigDecision,
  type AgentProjectConfigTrustRequest
} from '../../shared/agent-project-config-trust'
import type { Repo } from '../../shared/repo-types'
import {
  AGENT_PROJECT_CONFIG_ASK_TIMEOUT_MS,
  createAgentProjectConfigGate,
  setAgentProjectConfigGate
} from './agent-project-config-gate'
import { readStoredAgentProjectConfigDecision } from './agent-project-config-trust-store'

const AnswerSchema = z.object({
  requestId: z.string().uuid(),
  answer: z.enum(['trust', 'user-only', 'dismissed'])
})

/**
 * The desktop window answers the trust prompt. The gate is installed only here, so only chats
 * this app starts on this Mac are held to it.
 */
export function installAgentProjectConfigTrust(
  mainWindow: BrowserWindow,
  getRepos: () => Repo[]
): void {
  const waiting = new Map<string, (decision: AgentProjectConfigDecision | null) => void>()
  const ask = (
    request: AgentProjectConfigTrustRequest
  ): Promise<AgentProjectConfigDecision | null> =>
    new Promise((resolve) => {
      if (mainWindow.isDestroyed()) {
        resolve(null)
        return
      }
      const timer = setTimeout(() => settle(null), AGENT_PROJECT_CONFIG_ASK_TIMEOUT_MS)
      const settle = (decision: AgentProjectConfigDecision | null): void => {
        clearTimeout(timer)
        waiting.delete(request.requestId)
        resolve(decision)
      }
      waiting.set(request.requestId, settle)
      mainWindow.webContents.send(AGENT_PROJECT_CONFIG_ASK_CHANNEL, request)
    })
  ipcMain.removeHandler(AGENT_PROJECT_CONFIG_ANSWER_CHANNEL)
  ipcMain.handle(AGENT_PROJECT_CONFIG_ANSWER_CHANNEL, (event, raw: unknown) => {
    // Only the window that was asked may answer, and only a request that is still open.
    if (mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      return
    }
    const { requestId, answer } = AnswerSchema.parse(raw)
    // A prompt closed with no button pressed is no decision: nothing is kept, and it asks again.
    waiting.get(requestId)?.(answer === 'dismissed' ? null : answer)
  })
  const gate = createAgentProjectConfigGate({
    userDataPath: () => app.getPath('userData'),
    repoName: (projectKey) =>
      getRepos().find((repo) => repo.id === projectKey)?.displayName ?? projectKey,
    ask
  })
  setAgentProjectConfigGate(gate)
  // The repository's settings page shows the saved answer and lets the person be asked again.
  const knownRepoId = (raw: unknown): string | null => {
    const repoId = z.string().min(1).max(512).safeParse(raw)
    return repoId.success && getRepos().some((repo) => repo.id === repoId.data) ? repoId.data : null
  }
  ipcMain.removeHandler(AGENT_PROJECT_CONFIG_DECISION_CHANNEL)
  ipcMain.handle(AGENT_PROJECT_CONFIG_DECISION_CHANNEL, (_event, raw: unknown) => {
    const repoId = knownRepoId(raw)
    return repoId
      ? (readStoredAgentProjectConfigDecision(app.getPath('userData'), repoId)?.decision ?? null)
      : null
  })
  ipcMain.removeHandler(AGENT_PROJECT_CONFIG_FORGET_CHANNEL)
  ipcMain.handle(AGENT_PROJECT_CONFIG_FORGET_CHANNEL, (event, raw: unknown) => {
    const repoId = knownRepoId(raw)
    if (repoId && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents) {
      gate.forget(repoId)
    }
  })
}
