import type { ZshStartupHookSpec } from '../../pty/shell-startup/zsh-startup-wrapper-builder'
import { SHELL_READY_MARKER } from './daemon-shell-ready-marker'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

export function getDaemonZshWrapperSpec(): ZshStartupHookSpec {
  return {
    headerLabel: `${FORK_PRODUCT_NAME} daemon zsh shell-ready wrapper`,
    readyMarkerEscaped: SHELL_READY_MARKER,
    osc133CommandMarkers: true,
    startupCommandDelivery: false,
    overlayRestoreComment:
      "# Why: ~/.zshrc can export the user's default OpenCode config after spawn.",
    restores: {
      managedWslCli: false,
      agentTeamsPath: true,
      remoteCliBinDir: false,
      codexHome: true
    }
  }
}
