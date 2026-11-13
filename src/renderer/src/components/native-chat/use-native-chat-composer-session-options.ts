import type { RefObject } from 'react'
import { useRegisterComposerSurface } from './native-chat-composer-surface-registry'
import { useNativeChatSessionOptionCommand } from './use-native-chat-session-option-command'
import { useNativeChatSessionOptions } from './use-native-chat-session-options'
import type { NativeChatComposerProps } from './native-chat-composer-types'
import type {
  SessionOptionDescriptor,
  SessionOptionsSurface
} from '../../../../shared/native-chat/input/native-chat-session-options'

type ComposerSessionOptionsArgs = Pick<
  NativeChatComposerProps,
  | 'agent'
  | 'terminalTabId'
  | 'targetPtyId'
  | 'paneKey'
  | 'onSlashCommand'
  | 'onSubmitted'
  | 'onSwitchToTerminal'
  | 'readTerminalScreen'
  | 'structuredTransport'
> &
  Pick<Parameters<typeof useNativeChatSessionOptionCommand>[0], 'disabled' | 'resolveTarget'> & {
    /** The composer's root, so app-level keys can reach this chat's options. */
    root?: RefObject<HTMLElement | null>
  }

export function useNativeChatComposerSessionOptions({
  agent,
  disabled,
  onSlashCommand,
  onSubmitted,
  resolveTarget,
  terminalTabId,
  targetPtyId,
  onSwitchToTerminal,
  readTerminalScreen,
  paneKey,
  structuredTransport,
  root
}: ComposerSessionOptionsArgs): {
  isDispatching: boolean
  pty: ReturnType<typeof useNativeChatSessionOptions>
  surface: SessionOptionsSurface | null
  snapshot: SessionOptionDescriptor[]
} {
  const { dispatch, isDispatching } = useNativeChatSessionOptionCommand({
    agent,
    disabled,
    onSlashCommand,
    onSubmitted,
    resolveTarget
  })
  const pty = useNativeChatSessionOptions({
    agent,
    terminalTabId,
    targetPtyId,
    dispatchCommand: dispatch,
    onAgentPicker: onSwitchToTerminal,
    readTerminalScreen,
    paneKey
  })
  const surface = structuredTransport?.optionsSurface ?? pty.surface
  const snapshot = structuredTransport?.optionSnapshot ?? pty.snapshot
  useRegisterComposerSurface(root, surface, snapshot)
  return { isDispatching, pty, surface, snapshot }
}
