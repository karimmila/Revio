import { Sandbox } from '@vercel/sandbox'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import type { CloudPublicPort, CloudPublicPorts } from '../../shared/cloud/cloud-types'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { runSandboxScript } from './cloud-sandbox-run'
import {
  checkShareablePort,
  parseListeningPorts,
  portsAfter,
  publicUrlOf,
  sharedPortsOf
} from './cloud-public-ports-plan'

/**
 * Public links ride Vercel's own port routes: `Sandbox.update({ ports })` adds or drops a route on
 * the running sandbox, so nothing runs in the sandbox for this and no credential is sent to it.
 * Vercel's routes are the only record; Orca keeps none, so the panel can never show a link as off
 * while Vercel still serves it.
 */

// Two clicks must not race: each update sends the full port list, so the later one would undo
// the earlier one.
const queues = new Map<string, Promise<unknown>>()

function serialized<T>(environmentId: string, run: () => Promise<T>): Promise<T> {
  // The previous caller already received its own failure; the queue only waits for it.
  const next = (queues.get(environmentId) ?? Promise.resolve()).catch(() => undefined).then(run)
  queues.set(environmentId, next)
  return next
}

function sandboxNameOf(userDataPath: string, environmentId: string): string {
  const runtime = listEphemeralVmRuntimes(userDataPath).find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      entry.runtimeEnvironmentId === environmentId &&
      entry.status === 'running'
  )
  const userData = runtime?.recipeResult?.userData
  const name = userData && typeof userData === 'object' ? userData.sandboxName : undefined
  if (typeof name !== 'string') {
    throw new Error('This workspace has no running cloud sandbox. Open it first.')
  }
  return name
}

async function runningSandbox(userDataPath: string, environmentId: string): Promise<Sandbox> {
  return Sandbox.get({
    ...(await vercelScope()),
    name: sandboxNameOf(userDataPath, environmentId)
  })
}

const LISTENERS_SCRIPT = 'ss -ltnH 2>/dev/null || true'

export async function readPublicPorts(
  userDataPath: string,
  environmentId: string
): Promise<CloudPublicPorts> {
  const sandbox = await runningSandbox(userDataPath, environmentId)
  const shared = sharedPortsOf(sandbox.routes)
  const sharedPorts = new Set(shared.map((entry) => entry.port))
  const listening = parseListeningPorts(await runSandboxScript(sandbox, LISTENERS_SCRIPT)).filter(
    (entry) => !sharedPorts.has(entry.port)
  )
  return { shared, listening }
}

export async function sharePortPublicly(
  userDataPath: string,
  environmentId: string,
  port: unknown
): Promise<CloudPublicPort> {
  const checked = checkShareablePort(port)
  return serialized(environmentId, async () => {
    const sandbox = await runningSandbox(userDataPath, environmentId)
    await sandbox.update({ ports: portsAfter(sandbox.routes, checked, 'share') })
    // The update's reply carries routes only sometimes; fetch them when it did not.
    const route =
      sandbox.routes.find((entry) => entry.port === checked) ??
      (await runningSandbox(userDataPath, environmentId)).routes.find(
        (entry) => entry.port === checked
      )
    if (!route) {
      throw new Error(`Vercel did not give port ${checked} a public address.`)
    }
    return { port: checked, url: publicUrlOf(route) }
  })
}

export async function stopSharingPort(
  userDataPath: string,
  environmentId: string,
  port: unknown
): Promise<void> {
  const checked = checkShareablePort(port)
  return serialized(environmentId, async () => {
    const sandbox = await runningSandbox(userDataPath, environmentId)
    await sandbox.update({ ports: portsAfter(sandbox.routes, checked, 'unshare') })
    // Read back from Vercel instead of trusting the update's reply: "Disable" must mean the
    // route is gone.
    const after = await runningSandbox(userDataPath, environmentId)
    if (after.routes.some((entry) => entry.port === checked)) {
      throw new Error(`Port ${checked} is still public. Try Disable again.`)
    }
  })
}
