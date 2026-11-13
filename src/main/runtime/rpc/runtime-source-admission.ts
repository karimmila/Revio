import { ExpectedRuntimeSourceSchema } from '../../../shared/runtime-rpc-envelope'
import { getPublishedHostDescriptor } from '../hosts/platform-probe/host-descriptor'
import type { RpcEnvelopeMeta, RpcRequest, RpcResponse } from './core'
import { errorResponse } from './errors'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

/** Refuses, before any handler runs, a request whose client expects another runtime. */
export function runtimeSourceFence(request: RpcRequest, meta: RpcEnvelopeMeta): RpcResponse | null {
  if (request.expectedRuntimeSource === undefined) {
    return null
  }
  const parsed = ExpectedRuntimeSourceSchema.safeParse(request.expectedRuntimeSource)
  if (!parsed.success) {
    return errorResponse(
      request.id,
      meta,
      'bad_request',
      'Malformed expectedRuntimeSource. Nothing was run.'
    )
  }
  const sourceId = getPublishedHostDescriptor(meta.runtimeId)?.installationId
  if (!sourceId) {
    return errorResponse(
      request.id,
      meta,
      'runtime_source_unverifiable',
      `This ${FORK_PRODUCT_NAME} does not know which profile it serves, so it cannot confirm it is the ${FORK_PRODUCT_NAME} that launched this terminal. Nothing was run.`
    )
  }
  if (sourceId !== parsed.data.sourceId || meta.runtimeId !== parsed.data.runtimeId) {
    return errorResponse(
      request.id,
      meta,
      'runtime_source_mismatch',
      `This request was meant for another ${FORK_PRODUCT_NAME} (another profile or instance). Nothing was run. Open a new terminal from the ${FORK_PRODUCT_NAME} you want to control.`
    )
  }
  return null
}
