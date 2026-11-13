import type { RpcContext } from '../../core'
import { rpcCallerOperationKey } from '../../rpc-caller-identity'
import { HostAccountSignInFlows } from '../../../host-account-sign-in-flows'
import type { OrcaRuntimeService } from '../../../orca-runtime'

const hostSignIns = new WeakMap<OrcaRuntimeService, HostAccountSignInFlows>()
export function hostSignInFlows(runtime: OrcaRuntimeService): HostAccountSignInFlows {
  let flows = hostSignIns.get(runtime)
  if (!flows) {
    flows = new HostAccountSignInFlows((provider, channel) =>
      runtime.runHostAccountSignIn(provider, channel)
    )
    hostSignIns.set(runtime, flows)
  }
  return flows
}

/** The caller a sign-in belongs to, as its transport proved it; one it can't name gets none. */
export function signInOwner({ caller }: Pick<RpcContext, 'caller'>): string {
  if (!caller) {
    throw new Error('This client cannot add accounts on this host.')
  }
  return rpcCallerOperationKey(caller)
}
