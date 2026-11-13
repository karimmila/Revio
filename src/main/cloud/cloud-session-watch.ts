import { Sandbox } from '@vercel/sandbox'
import {
  listEphemeralVmRuntimes,
  updateEphemeralVmRuntimeStatus
} from '../../shared/ephemeral-vm-runtime-store'
import type { EphemeralVmRuntimeRecord } from '../../shared/ephemeral-vm-runtimes'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { disconnectRuntimeOwnedSshTarget } from '../ephemeral-vm/runtime-ssh'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { isSandboxGone } from './cloud-errors'
import { idleSinceMs, markCloudBusy, sandboxActivity } from './cloud-idle'
import { bestEffort, cloudWarn } from './cloud-log'

const WATCH_INTERVAL_MS = 60_000
// A pass that hangs (a Vercel call or a probe into an overloaded sandbox) must not stop the
// watch: in an e2e run a stalled pass left a Vercel-stopped workspace "running" for ~39 min,
// with SSH reconnecting to it the whole time.
const PASS_TIMEOUT_MS = 45_000
const CALL_TIMEOUT_MS = 20_000

/** Settles when the promise does or the pass is aborted, whichever comes first. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) {
    return promise
  }
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason ?? new Error('aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

function callSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(CALL_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}
const ENDED = new Set(['stopping', 'stopped', 'failed', 'aborted'])

function sandboxNameOf(runtime: EphemeralVmRuntimeRecord): string | null {
  const userData = runtime.recipeResult?.userData
  const name = userData && typeof userData === 'object' ? userData.sandboxName : undefined
  return typeof name === 'string' ? name : null
}

/**
 * Vercel ends a sandbox session on its own at the plan's limit (45 minutes on Hobby, a day on
 * Pro). Sandboxes are created with that limit already, so extending cannot help. Instead Orca
 * notices the stop and records the workspace's VM as suspended, the same state its own Sleep
 * leaves; opening the workspace then resumes the sandbox (files kept) and runs the wake script.
 */
/**
 * Idle sleep: a workspace nobody has open, with no agent working (both reported by the window),
 * no foreground job in any terminal and no terminal output for the whole window. Checked inside
 * the sandbox only once Orca's own signals have been quiet that long.
 */
async function idleLongEnough(
  sandbox: Sandbox,
  environmentId: string | undefined,
  idleMinutes: number
): Promise<boolean> {
  const idleMs = idleMinutes * 60_000
  if (idleMs <= 0 || !environmentId || idleSinceMs(environmentId) < idleMs) {
    return false
  }
  const activity = await sandboxActivity(sandbox).catch(() => null)
  if (!activity || activity.foregroundJob) {
    markCloudBusy(environmentId)
    return false
  }
  return activity.idleMs >= idleMs
}

export async function reconcileCloudSessions(
  userDataPath: string,
  idleMinutes = 0,
  signal?: AbortSignal
): Promise<string[]> {
  const running = listEphemeralVmRuntimes(userDataPath).filter(
    (runtime) => runtime.recipeId === VERCEL_CLOUD_RECIPE_ID && runtime.status === 'running'
  )
  if (running.length === 0) {
    return []
  }
  const scope = await untilAborted(vercelScope(), signal)
  const suspended: string[] = []
  for (const runtime of running) {
    signal?.throwIfAborted()
    const name = sandboxNameOf(runtime)
    if (!name) {
      continue
    }
    try {
      const sandbox = await untilAborted(
        Sandbox.get({ ...scope, name, signal: callSignal(signal) }),
        signal
      )
      if (!ENDED.has(sandbox.status)) {
        const idle = await untilAborted(
          idleLongEnough(sandbox, runtime.runtimeEnvironmentId, idleMinutes),
          signal
        )
        if (idle) {
          // Idle sleep: the same stop Orca's Sleep does; files stay, opening resumes it.
          await untilAborted(sandbox.stop({ signal: callSignal(signal) }), signal)
        } else {
          continue
        }
      }
      updateEphemeralVmRuntimeStatus(userDataPath, runtime.id, { status: 'suspended' })
      await disconnectRuntimeOwnedSshTarget(runtime.sshTargetId).catch(
        bestEffort('Disconnecting a stopped workspace')
      )
      suspended.push(runtime.id)
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }
      // Deleted outside Orca: treat it as stopped, so opening the workspace runs resume, which
      // says plainly that the sandbox is gone and the workspace can be archived. Anything else
      // (Vercel unreachable) waits for the next pass.
      if (isSandboxGone(error)) {
        updateEphemeralVmRuntimeStatus(userDataPath, runtime.id, { status: 'suspended' })
        await disconnectRuntimeOwnedSshTarget(runtime.sshTargetId).catch(
          bestEffort('Disconnecting a deleted workspace')
        )
        suspended.push(runtime.id)
      }
    }
  }
  return suspended
}

/**
 * One pass a minute. A pass that hangs is aborted after PASS_TIMEOUT_MS, and the next one starts
 * only once it has settled, so two passes never stop or suspend the same workspace at once.
 */
export function startCloudSessionWatch(
  userDataPath: () => string,
  idleMinutes: () => number
): () => void {
  let busy = false
  const timer = setInterval(() => {
    if (busy) {
      return
    }
    busy = true
    const abort = new AbortController()
    const deadline = setTimeout(() => abort.abort(new Error('timed out')), PASS_TIMEOUT_MS)
    void reconcileCloudSessions(userDataPath(), idleMinutes(), abort.signal)
      .catch((error: unknown) => cloudWarn('Session watch pass failed', error))
      .finally(() => {
        clearTimeout(deadline)
        busy = false
      })
  }, WATCH_INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}
