import { translate } from '@/i18n/i18n'
import { tuiAgentDisplayName } from '../../../../shared/agent-launch/catalog/tui-agent-display-names'
import { requiredToolInstallCommand } from '../../../../shared/missing-tool-install'

/**
 * Under "Claude wasn't found on the computer running this chat": the command that installs it.
 * Only for a chat on this computer; a remote host or WSL distro has its own install steps.
 */
export function NativeChatCliInstallHint({
  failureKind,
  agentName,
  localChat
}: {
  failureKind: string | undefined
  agentName: string | undefined
  localChat: boolean
}): React.JSX.Element | null {
  if (failureKind !== 'cliMissing' || !localChat || agentName !== tuiAgentDisplayName('claude')) {
    return null
  }
  const command = requiredToolInstallCommand('claude', window.api?.platform?.get?.().platform ?? '')
  if (!command) {
    return null
  }
  return (
    <div className="space-y-1 text-xs text-chat-foreground-faint">
      <p>
        {translate(
          'components.native-chat.cliInstallHint.claude',
          'To install Claude Code, run this in a terminal, then send your message again:'
        )}
      </p>
      <code className="block select-all rounded bg-muted px-2 py-1 font-mono text-chat-foreground">
        {command}
      </code>
    </div>
  )
}
