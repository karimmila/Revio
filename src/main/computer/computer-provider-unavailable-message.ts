import { FORK_COMPUTER_USE_HELPER_NAME, FORK_PRODUCT_NAME } from '../../shared/fork-identity'
export function computerProviderUnavailableMessage(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return [
      `computer-use has no native provider for darwin because ${FORK_COMPUTER_USE_HELPER_NAME}.app was not found or this macOS version is unsupported.`,
      `For local development, run pnpm build:computer-macos and restart ${FORK_PRODUCT_NAME} from this worktree.`
    ].join(' ')
  }
  if (platform === 'linux' || platform === 'win32') {
    const runtime =
      platform === 'linux' ? 'computer-use-linux/runtime.py' : 'computer-use-windows/runtime.ps1'
    return `Computer use isn't available on this host: its ${FORK_PRODUCT_NAME} install has no ${runtime}. On a ${FORK_PRODUCT_NAME} server installed before computer use shipped with it, update or reprovision the server.`
  }
  return `computer-use has no native provider for ${platform}`
}
