import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'
import type { CodexAppServerConnection } from './codex-app-server-connection-types'

/** The caller owns the bound; null leaves cancellation to its startup signal. */
export async function initializeCodexAppServerConnection(
  connection: CodexAppServerConnection,
  timeoutMs: number | null
): Promise<void> {
  await connection.request(
    'initialize',
    {
      clientInfo: { name: 'orca_desktop', title: FORK_PRODUCT_NAME, version: '0.0.0' },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        mcpServerOpenaiFormElicitation: false,
        extensions: {}
      }
    },
    { timeoutMs }
  )
  connection.notify('initialized')
}
