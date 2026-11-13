import { withRemoteRuntimeTailscaleHint } from '../../../shared/remote-runtime/remote-runtime-tailscale-hint'
import { classifyRuntimeEnvironmentHost } from '../../../shared/remote-runtime/host-catalog/runtime-environment-host-kind'
import type { KnownRuntimeEnvironment } from '../../../shared/remote-runtime/host-catalog/runtime-environments'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

const UNREACHABLE_RE =
  /could not connect to the remote \w+ runtime|remote \w+ runtime closed the connection|timed out (?:waiting for|while connecting to) the remote \w+ runtime/i

export function withRuntimeUnreachableHint(
  environment: Pick<KnownRuntimeEnvironment, 'orcadDeployment' | 'sshAccess'>,
  message: string,
  endpoint: string | null | undefined
): string {
  const host = classifyRuntimeEnvironmentHost(environment)
  switch (host.kind) {
    case 'network':
      return withRemoteRuntimeTailscaleHint(message, endpoint)
    case 'ssh':
      // An SSH tunnel already crosses networks; Tailscale cannot help it.
      return message
    case 'wsl':
      // WSL is reached locally through wsl.exe; a Tailscale hint cannot help.
      return UNREACHABLE_RE.test(message)
        ? `${message} The ${FORK_PRODUCT_NAME} server in the WSL distro ${host.deployment.distro} isn’t answering; connect it again in Settings → Remote ${FORK_PRODUCT_NAME} Servers → WSL hosts.`
        : message
  }
}
