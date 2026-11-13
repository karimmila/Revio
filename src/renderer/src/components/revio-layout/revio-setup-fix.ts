import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { stripAnsiEscapeSequences } from '../../../../shared/ansi-escape-sequences'
import { revioSetupTabs } from './revio-setup-rerun'
import { launchRevioAgentChat } from './launch-revio-chat'
import { FORK_PRODUCT_NAME } from '../../../../shared/fork-identity'
import { WORKSPACE_CONFIG_FILE } from '../../../../shared/workspace-config-file'

// The tail holds the failure; a long install log would otherwise crowd the agent's context.
const MAX_LOG_CHARS = 20_000

const NO_LOGS =
  'Setup logs are unavailable because the Setup tab was closed. Rerun setup to see the failure.'

/** Terminal output as plain text: no colors or cursor moves, and only the last MAX_LOG_CHARS. */
export function setupLogText(raw: string): string {
  const text = stripAnsiEscapeSequences(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > MAX_LOG_CHARS ? `…\n${text.slice(-MAX_LOG_CHARS)}` : text
}

/** "Setup script failed — fix it?" message: what failed, the script, and its output. */
export function setupFixPrompt({ script, logs }: { script: string | null; logs: string }): string {
  const parts = [
    `This workspace's setup script failed. (${FORK_PRODUCT_NAME} runs the setup script in each new workspace after creating it.) Can you find out why and fix it?`
  ]
  if (script?.trim()) {
    parts.push(
      `The setup script is:\n\`\`\`sh\n${script.trim()}\n\`\`\`\nThe user can change it in the repository settings (Setup script) or in ${WORKSPACE_CONFIG_FILE}.`
    )
  }
  parts.push(`Setup logs:\n\`\`\`\n${logs || NO_LOGS}\n\`\`\``)
  return parts.join('\n\n')
}

async function readSetupLogs(worktreeId: string): Promise<string> {
  const ptyIds = revioSetupTabs(worktreeId).flatMap((tab) => tab.localPtyIds)
  const outputs = await Promise.all(
    ptyIds.map((id) =>
      window.api.pty
        .getMainBufferSnapshot(id)
        .then((snapshot) => setupLogText(snapshot?.data ?? ''))
        .catch(() => '')
    )
  )
  return outputs.filter(Boolean).join('\n\n')
}

async function setupScriptOf(worktreeId: string): Promise<string | null> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!repo) {
    return null
  }
  const fromSettings = repo.hookSettings?.scripts.setup?.trim()
  if (fromSettings) {
    return fromSettings
  }
  const checked = await window.api.hooks.check({ repoId: repo.id }).catch(() => null)
  return checked?.hooks?.scripts?.setup?.trim() || null
}

/** Hands the failed setup's output to the agent in a new chat in the workspace. */
export async function fixSetupWithAgent(worktreeId: string): Promise<boolean> {
  const [script, logs] = await Promise.all([setupScriptOf(worktreeId), readSetupLogs(worktreeId)])
  return launchRevioAgentChat(worktreeId, { prompt: setupFixPrompt({ script, logs }) })
}
