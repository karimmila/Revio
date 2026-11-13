import { translate } from '@/i18n/i18n'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import type {
  AgentProjectConfigItem,
  AgentProjectConfigItemKind,
  AgentProjectConfigTrustRequest
} from '../../../../shared/agent-project-config-trust'

const MAX_LINES = 40

function kindLabel(kind: AgentProjectConfigItemKind): string {
  switch (kind) {
    case 'hook':
      return translate('components.agentProjectConfig.kindHook', 'Hook')
    case 'mcp-server':
      return translate('components.agentProjectConfig.kindMcp', 'MCP server')
    case 'command':
      return translate('components.agentProjectConfig.kindCommand', 'Command')
    case 'environment':
      return translate('components.agentProjectConfig.kindEnvironment', 'Environment variable')
    case 'permissions':
      return translate('components.agentProjectConfig.kindPermissions', 'Permission rules')
    case 'plugins':
      return translate('components.agentProjectConfig.kindPlugins', 'Plugins')
  }
}

function line(item: AgentProjectConfigItem): string {
  const what = item.detail ? `${item.name}: ${item.detail}` : item.name
  return `${kindLabel(item.kind)} · ${what} (${item.file})`
}

/** The one-time question before a chat loads a repository's own agent settings. */
export function agentProjectConfigTrustDialog(
  request: Pick<AgentProjectConfigTrustRequest, 'repoName' | 'items'>
): ConfirmationDialogOptions {
  const shown = request.items.slice(0, MAX_LINES).map(line)
  const more = request.items.length - shown.length
  if (more > 0) {
    shown.push(
      translate('components.agentProjectConfig.more', 'and {{value0}} more', { value0: more })
    )
  }
  return {
    title: translate('components.agentProjectConfig.title', 'Trust {{value0}}?', {
      value0: request.repoName
    }),
    description: `${translate(
      'components.agentProjectConfig.body',
      'This repository includes agent hooks, MCP servers or settings that run commands on your Mac when a chat starts:'
    )}\n\n${shown.join('\n')}\n\n${translate(
      'components.agentProjectConfig.choice',
      'Trust it only if you know where it came from. Without trust, chats here use your own settings and leave the repository’s out. You are asked again when these files change.'
    )}`,
    descriptionClassName: 'max-h-72 overflow-auto whitespace-pre-wrap break-words',
    surface: 'security',
    confirmLabel: translate('components.agentProjectConfig.trust', 'Trust this repository'),
    cancelLabel: translate('components.agentProjectConfig.without', 'Run without project settings'),
    ignoresOpeningGesture: true
  }
}
