import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  listEphemeralVmRuntimes,
  upsertEphemeralVmRuntime
} from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'

const handlers = new Map<string, (_event: unknown, args: unknown) => unknown>()
const h = vi.hoisted(() => ({
  getPath: vi.fn(),
  guard: vi.fn(),
  removeTarget: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: h.getPath },
  ipcMain: {
    handle: (channel: string, handler: (_event: unknown, args: unknown) => unknown) =>
      handlers.set(channel, handler),
    removeHandler: vi.fn()
  }
}))
vi.mock('../cloud/cloud-destroy-guard', () => ({
  CLOUD_DISCARD_FAILED_CREATE: 'failed-create',
  archiveCloudRuntimeBeforeDestroy: h.guard
}))
vi.mock('./runtime-environments/runtime-environments', () => ({
  invalidateRuntimeEnvironmentTransport: vi.fn(async () => {})
}))
vi.mock('../ephemeral-vm/runtime-ssh', () => ({
  connectRuntimeOwnedSshTarget: vi.fn(),
  disconnectRuntimeOwnedSshTarget: vi.fn(),
  removeRuntimeOwnedSshTarget: h.removeTarget
}))

import { registerEphemeralVmRuntimeHandlers } from './ephemeral-vm-runtime-handlers'

let userDataPath = ''

beforeEach(() => {
  handlers.clear()
  h.guard.mockReset()
  userDataPath = mkdtempSync(join(tmpdir(), 'revio-cleanup-guard-'))
  h.getPath.mockReturnValue(userDataPath)
  upsertEphemeralVmRuntime(userDataPath, {
    id: 'orca-cloud-1',
    recipeId: VERCEL_CLOUD_RECIPE_ID,
    repoId: 'mac-repo',
    status: 'running',
    cleanupStatus: 'not_started',
    createdAt: 1,
    updatedAt: 1,
    recipeResult: {
      schemaVersion: 1,
      connection: {
        type: 'ssh',
        projectRoot: '/vercel/repo',
        target: { label: 'cloud', host: 'host', port: 22, username: 'ubuntu' }
      },
      userData: { sandboxName: 'revio-cloud-1' }
    }
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the cleanup handler reads the store only after the mocked guard, which these tests stop or skip past.
  registerEphemeralVmRuntimeHandlers({ getRepo: vi.fn() } as never)
})

afterEach(() => {
  rmSync(userDataPath, { recursive: true, force: true })
})

it('keeps a cloud workspace whose restore point could not be kept: nothing is destroyed', async () => {
  h.guard.mockRejectedValue(new Error('fetch failed: socket hang up'))
  await expect(
    handlers.get('ephemeralVm:cleanup')?.(null, { runtimeId: 'orca-cloud-1' })
  ).rejects.toThrow(/socket hang up/)
  expect(h.guard).toHaveBeenCalledWith(userDataPath, 'orca-cloud-1', undefined, {}, [])
  expect(listEphemeralVmRuntimes(userDataPath)[0]).toMatchObject({
    status: 'running',
    cleanupStatus: 'not_started'
  })
})

it('archives before every destroy, and skips that only for a failed create', async () => {
  h.guard.mockResolvedValue(undefined)
  await handlers.get('ephemeralVm:cleanup')?.(null, {
    runtimeId: 'orca-cloud-1',
    discard: 'anything-else'
  })
  expect(h.guard).toHaveBeenLastCalledWith(userDataPath, 'orca-cloud-1', undefined, {}, [])
  await handlers.get('ephemeralVm:cleanup')?.(null, {
    runtimeId: 'orca-cloud-1',
    discard: 'failed-create'
  })
  expect(h.guard).toHaveBeenLastCalledWith(userDataPath, 'orca-cloud-1', 'failed-create', {}, [])
})

it('hands the chats from the window to the archive record, dropping malformed ones', async () => {
  h.guard.mockResolvedValue(undefined)
  const chats = [{ agent: 'claude', sessionId: 'claude_1', providerSessionId: 'prov-1' }]
  await handlers.get('ephemeralVm:cleanup')?.(null, { runtimeId: 'orca-cloud-1', chats })
  expect(h.guard).toHaveBeenLastCalledWith(userDataPath, 'orca-cloud-1', undefined, {}, chats)
  await handlers.get('ephemeralVm:cleanup')?.(null, {
    runtimeId: 'orca-cloud-1',
    chats: [{ sessionId: 'no-agent' }]
  })
  expect(h.guard).toHaveBeenLastCalledWith(userDataPath, 'orca-cloud-1', undefined, {}, [])
})
