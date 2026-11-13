import { dirname, join } from 'node:path'
import { readFile, rm } from 'node:fs/promises'
import { parseHooksJsonText } from '../../agent-hooks/hooks-json-read'
import type { HooksConfig } from '../../agent-hooks/installer-utils'
import { writeHooksJsonAsync } from '../../agent-hooks/hooks-json-write-async'
import {
  parseClaudeAgentViewBindings,
  serializeClaudeAgentViewBindings
} from './agent-view-keybindings'
import {
  ownership,
  markerName,
  planClaudeAgentViewInstall,
  planClaudeAgentViewDisable
} from './agent-view-binding-plan'
import { refreshClaudeAgentView } from './agent-view-install'
import { serializeClaudeAgentViewConfig } from './agent-view-config-lock'

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/** True when the file holds only the empty list this app leaves after taking its own binding out. */
function isLeftoverBindingsFile(config: HooksConfig): boolean {
  return JSON.stringify(config) === '{"bindings":[]}'
}

export async function reconcileClaudeAgentViewConfig(
  configPath: string,
  enabled: boolean,
  // Retired: the layout has no terminal agent view, so nothing of it may stay in the user's config.
  options: { retired?: boolean } = {}
): Promise<void> {
  await refreshClaudeAgentView(configPath)
  await serializeClaudeAgentViewConfig(configPath, async () => {
    const configDir = dirname(configPath)
    const markerPath = join(configDir, markerName)
    const markerRaw = await readOptional(markerPath)
    const previous = markerRaw === null ? undefined : parseHooksJsonText(markerRaw)
    if (!enabled && previous?.owner !== ownership.owner) {
      return
    }
    const path = join(configDir, 'keybindings.json')
    const raw = await readOptional(path)
    const config = parseClaudeAgentViewBindings(raw)
    if (enabled) {
      if (!config) {
        return
      }
      const plan = planClaudeAgentViewInstall(raw, config, previous)
      if (!plan.marker) {
        return
      }
      await writeHooksJsonAsync(markerPath, plan.marker)
      await writeHooksJsonAsync(path, plan.config, {
        serialized: serializeClaudeAgentViewBindings(raw, plan.config)
      })
    } else if (previous) {
      const plan = planClaudeAgentViewDisable(config, previous)
      const retired = options.retired === true && plan.config !== null
      if (!retired) {
        await writeHooksJsonAsync(markerPath, plan.marker)
      }
      if (plan.config && JSON.stringify(config) !== JSON.stringify(plan.config)) {
        await (retired && isLeftoverBindingsFile(plan.config)
          ? rm(path, { force: true })
          : writeHooksJsonAsync(path, plan.config, {
              serialized: serializeClaudeAgentViewBindings(raw, plan.config)
            }))
      }
      if (retired) {
        await rm(markerPath, { force: true })
      }
    }
  })
}
