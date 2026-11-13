import { FORK_PRODUCT_NAME } from '../fork-identity'
export type RemoteRuntimeClientErrorLike = { code?: string; message: string }

export const RUNTIME_RPC_QUEUE_OVERLOAD_CODE = 'runtime_rpc_queue_overloaded'
export const RUNTIME_RPC_QUEUE_OVERLOAD_MESSAGE_FRAGMENT = 'remote runtime call queue is full'

// Export for the transport-error corpus guard’s code/message agreement check.
export const RECOVERABLE_CODES: ReadonlySet<string> = new Set([
  'remote_runtime_unavailable',
  // A client-side admission cap that frees as pending work settles; fatal would dead-end panes.
  'remote_runtime_busy',
  RUNTIME_RPC_QUEUE_OVERLOAD_CODE,
  'runtime_timeout',
  'runtime_unavailable',
  'reconnecting',
  'timeout'
])

// Older hosts and upstream Orca say "orca"; this build says its own product name.
const RUNTIME_NAMES = [...new Set(['orca', FORK_PRODUCT_NAME.toLowerCase()])]

export const RECOVERABLE_MESSAGE_FRAGMENTS: readonly string[] = [
  ...RUNTIME_NAMES.flatMap((name) => [
    `could not connect to the remote ${name} runtime`,
    `remote ${name} runtime closed the connection`,
    `remote ${name} runtime connection closed`,
    `remote ${name} runtime is not connected`,
    `timed out waiting for the remote ${name} runtime`
  ]),
  RUNTIME_RPC_QUEUE_OVERLOAD_MESSAGE_FRAGMENT,
  'remote runtime connection closed',
  // remote_runtime_busy wording, for when IPC strips the code.
  'remote runtime connection wait limit reached',
  'remote runtime request limit reached',
  'remote runtime subscription limit reached',
  'remote runtime subscription memory limit reached',
  'remote runtime subscription closed before it started',
  'remote terminal stream is not connected'
]

export function isRuntimeRpcQueueOverloadError(error: RemoteRuntimeClientErrorLike): boolean {
  if (error.code) {
    return error.code === RUNTIME_RPC_QUEUE_OVERLOAD_CODE
  }
  return error.message.toLowerCase().includes(RUNTIME_RPC_QUEUE_OVERLOAD_MESSAGE_FRAGMENT)
}

export function isRecoverableRemoteRuntimeConnectionError(
  error: RemoteRuntimeClientErrorLike
): boolean {
  if (error.code) {
    return RECOVERABLE_CODES.has(error.code)
  }
  const message = error.message.toLowerCase()
  return RECOVERABLE_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))
}

export function toRemoteRuntimeClientErrorLike(error: unknown): RemoteRuntimeClientErrorLike {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown }
    if (typeof candidate.message === 'string') {
      return {
        ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
        message: candidate.message
      }
    }
  }
  return { message: String(error) }
}
