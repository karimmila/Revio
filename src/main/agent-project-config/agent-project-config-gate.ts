import { randomUUID } from 'node:crypto'
import type {
  AgentProjectConfigDecision,
  AgentProjectConfigTrustRequest
} from '../../shared/agent-project-config-trust'
import { inspectAgentProjectConfig } from './agent-project-config-inspect'
import {
  forgetAgentProjectConfigDecision,
  readAgentProjectConfigDecision,
  writeAgentProjectConfigDecision
} from './agent-project-config-trust-store'

export type ClaudeSettingSource = 'user' | 'project' | 'local'

const ALL_SOURCES: readonly ClaudeSettingSource[] = ['user', 'project', 'local']
const USER_ONLY: readonly ClaudeSettingSource[] = ['user']

/** How long the window may leave the prompt open before main stops waiting for it. */
export const AGENT_PROJECT_CONFIG_ASK_TIMEOUT_MS = 10 * 60_000
/**
 * How long one chat start waits for the answer. Past it that chat starts with the person's own
 * settings only, so a request to the chat host never times out behind an open prompt. The prompt
 * stays up, and its answer counts for every later start.
 */
export const AGENT_PROJECT_CONFIG_LAUNCH_HOLD_MS = 20_000
/** After no answer, launches in that project stop waiting for a while; they run user-only. */
export const AGENT_PROJECT_CONFIG_UNANSWERED_QUIET_MS = 10 * 60_000

export type AgentProjectConfigGateDeps = {
  userDataPath: () => string
  repoName: (projectKey: string) => string
  /** Shows the prompt; null when nobody could be asked (no window, or it closed). */
  ask: (request: AgentProjectConfigTrustRequest) => Promise<AgentProjectConfigDecision | null>
  now?: () => number
  inspect?: typeof inspectAgentProjectConfig
  /** Resolves when one chat start has waited long enough; tests pass their own. */
  launchHold?: () => Promise<void>
}

export type AgentProjectConfigGate = {
  settingSources: (input: {
    directory: string
    projectKey: string
  }) => Promise<readonly ClaudeSettingSource[]>
  /** Forgets what was decided for a project, so its next chat asks again. */
  forget: (projectKey: string) => void
}

/**
 * Decides which settings a Claude chat may load in a folder on this Mac. A repository's own
 * settings can run commands (hooks, MCP servers), and the SDK has no trust dialog, so they load
 * only once the person has trusted that exact content. Asked once per project and content; a No,
 * a timeout or any failure means the chat starts with the person's own settings only.
 */
export function createAgentProjectConfigGate(
  deps: AgentProjectConfigGateDeps
): AgentProjectConfigGate {
  const now = deps.now ?? Date.now
  const inspect = deps.inspect ?? inspectAgentProjectConfig
  const launchHold =
    deps.launchHold ??
    (() =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, AGENT_PROJECT_CONFIG_LAUNCH_HOLD_MS).unref?.()
      }))
  const asking = new Map<string, Promise<AgentProjectConfigDecision | null>>()
  const unansweredAt = new Map<string, number>()
  /**
   * Content the person chose to run without, for as long as the app runs. The saved decision is
   * found by project; this one is found by the content alone, so a chat that names its project
   * another way (a workspace still being created) does not ask about the same files again. Only
   * the refusal is remembered this way: it withholds settings and can never grant any.
   */
  const declinedThisSession = new Set<string>()

  const askOnce = (
    projectKey: string,
    hash: string,
    items: AgentProjectConfigTrustRequest['items']
  ): Promise<AgentProjectConfigDecision | null> => {
    const key = `${projectKey}\0${hash}`
    const quietSince = unansweredAt.get(key)
    if (quietSince !== undefined && now() - quietSince < AGENT_PROJECT_CONFIG_UNANSWERED_QUIET_MS) {
      return Promise.resolve(null)
    }
    const pending =
      asking.get(key) ??
      deps
        .ask({ requestId: randomUUID(), repoName: deps.repoName(projectKey), items })
        .catch(() => null)
        .then((decision) => {
          if (decision) {
            unansweredAt.delete(key)
            if (decision === 'user-only') {
              declinedThisSession.add(hash)
            } else {
              declinedThisSession.delete(hash)
            }
            writeAgentProjectConfigDecision(deps.userDataPath(), projectKey, hash, decision, now())
          } else {
            unansweredAt.set(key, now())
          }
          return decision
        })
        .finally(() => asking.delete(key))
    asking.set(key, pending)
    return pending
  }

  return {
    settingSources: async ({ directory, projectKey }) => {
      try {
        const found = inspect(directory)
        if (!found) {
          return ALL_SOURCES
        }
        const stored = readAgentProjectConfigDecision(deps.userDataPath(), projectKey, found.hash)
        if (!stored && declinedThisSession.has(found.hash)) {
          return USER_ONLY
        }
        const decision =
          stored ??
          (await Promise.race([
            askOnce(projectKey, found.hash, found.items),
            launchHold().then(() => null)
          ]))
        return decision === 'trust' ? ALL_SOURCES : USER_ONLY
      } catch {
        return USER_ONLY
      }
    },
    forget: (projectKey) => {
      forgetAgentProjectConfigDecision(deps.userDataPath(), projectKey)
      declinedThisSession.clear()
      for (const key of unansweredAt.keys()) {
        if (key.startsWith(`${projectKey}\0`)) {
          unansweredAt.delete(key)
        }
      }
    }
  }
}

// A global slot, like the GitHub App auth provider's: only the desktop app installs a gate. A
// headless host (a cloud sandbox's server, serve mode) has none, and there every source loads:
// the code runs inside that host, not on the person's Mac.
const SLOT = Symbol.for('orca.host.agentProjectConfigGate')

export function setAgentProjectConfigGate(gate: AgentProjectConfigGate | null): void {
  Reflect.set(globalThis, SLOT, gate)
}

function isGate(value: unknown): value is AgentProjectConfigGate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'settingSources' in value &&
    typeof value.settingSources === 'function'
  )
}

function installedGate(): AgentProjectConfigGate | null {
  const stored: unknown = Object.getOwnPropertyDescriptor(globalThis, SLOT)?.value
  return isGate(stored) ? stored : null
}

/** The settings a Claude chat starting in `directory` may load. */
export async function claudeSettingSourcesForLaunch(input: {
  directory: string
  projectKey: string
}): Promise<ClaudeSettingSource[]> {
  const gate = installedGate()
  return [...(gate ? await gate.settingSources(input) : ALL_SOURCES)]
}
