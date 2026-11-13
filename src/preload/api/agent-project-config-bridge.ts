import { ipcRenderer } from 'electron'
import {
  AGENT_PROJECT_CONFIG_ANSWER_CHANNEL,
  AGENT_PROJECT_CONFIG_ASK_CHANNEL,
  AGENT_PROJECT_CONFIG_DECISION_CHANNEL,
  AGENT_PROJECT_CONFIG_FORGET_CHANNEL,
  type AgentProjectConfigAnswer,
  type AgentProjectConfigDecision,
  type AgentProjectConfigTrustRequest
} from '../../shared/agent-project-config-trust'

export type AgentProjectConfigApi = {
  /** Main asks before a chat loads a repository's own agent settings; returns the unsubscribe. */
  onTrustRequest: (listener: (request: AgentProjectConfigTrustRequest) => void) => () => void
  answerTrustRequest: (requestId: string, answer: AgentProjectConfigAnswer) => Promise<void>
  /** The saved answer for a repository; null when it was never asked or the answer was forgotten. */
  decision: (repoId: string) => Promise<AgentProjectConfigDecision | null>
  /** Forgets the saved answer, so the next chat in the repository asks again. */
  forget: (repoId: string) => Promise<void>
}

export const agentProjectConfigApi: AgentProjectConfigApi = {
  onTrustRequest: (listener) => {
    const handler = (_event: unknown, request: AgentProjectConfigTrustRequest): void =>
      listener(request)
    ipcRenderer.on(AGENT_PROJECT_CONFIG_ASK_CHANNEL, handler)
    return () => ipcRenderer.removeListener(AGENT_PROJECT_CONFIG_ASK_CHANNEL, handler)
  },
  answerTrustRequest: (requestId, answer) =>
    ipcRenderer.invoke(AGENT_PROJECT_CONFIG_ANSWER_CHANNEL, { requestId, answer }),
  decision: (repoId) => ipcRenderer.invoke(AGENT_PROJECT_CONFIG_DECISION_CHANNEL, repoId),
  forget: (repoId) => ipcRenderer.invoke(AGENT_PROJECT_CONFIG_FORGET_CHANNEL, repoId)
}
