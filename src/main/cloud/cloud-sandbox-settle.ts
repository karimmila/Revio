import { Sandbox } from '@vercel/sandbox'
import { cloudInfo } from './cloud-log'

/** Vercel states in which a stop is still writing the sandbox's snapshot. */
const SETTLING = new Set(['stopping', 'snapshotting'])

export const SANDBOX_SETTLE_TIMEOUT_MS = 2 * 60_000
const SANDBOX_SETTLE_POLL_MS = 2_000

/**
 * A sandbox that is still stopping has not finished its stop snapshot; deleting it then could
 * lose the newest work. Re-reads it until the stop settles, or fails after the timeout.
 */
export async function waitForSandboxToSettle(
  sandbox: Sandbox,
  scope: { token: string; teamId: string; projectId: string },
  options: { timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<Sandbox> {
  const timeoutMs = options.timeoutMs ?? SANDBOX_SETTLE_TIMEOUT_MS
  const pollMs = options.pollMs ?? SANDBOX_SETTLE_POLL_MS
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const deadline = Date.now() + timeoutMs
  let current = sandbox
  if (SETTLING.has(current.status)) {
    cloudInfo(`waiting for ${sandbox.name} to finish stopping (${current.status})`)
  }
  while (SETTLING.has(current.status)) {
    if (Date.now() >= deadline) {
      throw new Error(
        'This cloud workspace is still going to sleep after two minutes. Try again in a moment.'
      )
    }
    await sleep(pollMs)
    current = await Sandbox.get({ ...scope, name: sandbox.name })
  }
  if (current !== sandbox) {
    cloudInfo(
      `${sandbox.name} stopped after ${Math.round((Date.now() + timeoutMs - deadline) / 1000)} s`
    )
  }
  return current
}
