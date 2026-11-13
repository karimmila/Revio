import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Sandbox } from '@vercel/sandbox'
import { z } from 'zod'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { writeSecureFile } from '../../shared/secure-file'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { isSandboxGone } from './cloud-errors'
import { cloudInfo, cloudWarn } from './cloud-log'
import { cloudDataRoot } from './cloud-repo-store'
import { retireSandbox } from './cloud-sandbox-retire'

/**
 * Sandboxes a create started but has not handed to a workspace yet. Written before
 * `Sandbox.create`, so a crash, quit or failed delete mid-create leaves a record, and the next
 * start either adopts the sandbox (a workspace owns it after all) or deletes it, instead of a
 * persistent sandbox billing storage that nothing in Orca points to.
 */
const PendingSchema = z.object({
  sandboxes: z.array(z.object({ name: z.string(), startedAt: z.number() }))
})
type Pending = z.infer<typeof PendingSchema>['sandboxes']

function file(): string {
  return join(cloudDataRoot(), 'pending-sandboxes.json')
}

function readPending(): Pending {
  try {
    if (!existsSync(file())) {
      return []
    }
    const parsed = PendingSchema.safeParse(JSON.parse(readFileSync(file(), 'utf8')))
    return parsed.success ? parsed.data.sandboxes : []
  } catch {
    return []
  }
}

function writePending(sandboxes: Pending): void {
  writeSecureFile(file(), `${JSON.stringify({ sandboxes }, null, 2)}\n`)
}

export function markSandboxPending(name: string, now = Date.now()): void {
  writePending([...readPending().filter((entry) => entry.name !== name), { name, startedAt: now }])
}

export function clearSandboxPending(name: string): void {
  writePending(readPending().filter((entry) => entry.name !== name))
}

export function pendingSandboxNames(): string[] {
  return readPending().map((entry) => entry.name)
}

function ownedByWorkspace(userDataPath: string, name: string): boolean {
  return listEphemeralVmRuntimes(userDataPath).some((runtime) => {
    const userData = runtime.recipeResult?.userData
    return (
      runtime.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      runtime.status !== 'cleaned' &&
      !!userData &&
      typeof userData === 'object' &&
      userData.sandboxName === name
    )
  })
}

/** At startup, when no create can be running: adopt or delete what an earlier run left. */
export async function sweepPendingSandboxes(userDataPath: string): Promise<void> {
  const orphans = pendingSandboxNames().filter((name) => {
    if (ownedByWorkspace(userDataPath, name)) {
      clearSandboxPending(name)
      return false
    }
    return true
  })
  if (orphans.length === 0) {
    return
  }
  const scope = await vercelScope()
  for (const name of orphans) {
    try {
      await retireSandbox(await Sandbox.get({ ...scope, name }), scope)
      cloudInfo(`Deleted ${name}, left behind by an unfinished create`)
      clearSandboxPending(name)
    } catch (error) {
      if (isSandboxGone(error)) {
        clearSandboxPending(name)
      } else {
        cloudWarn(`Cleaning up ${name} (will retry at the next start)`, error)
      }
    }
  }
}
