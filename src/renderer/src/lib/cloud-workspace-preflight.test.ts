// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ error: vi.fn(), message: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/components/revio-layout/RevioLocationSwitcher', () => ({
  openCloudSettings: vi.fn()
}))
const refreshCloudReadiness = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/cloud-readiness', () => ({ refreshCloudReadiness }))

const { assertCloudWorkspaceReady } = await import('./cloud-workspace-preflight')

const built = {
  builds: [{ state: 'succeeded', snapshotId: 'snap_12345678' }]
}

function cloudApi(check: 'ready' | 'expired') {
  return {
    repoState: vi.fn(async () => built),
    checkBuild: vi.fn(async () => check),
    startBuild: vi.fn(async () => ({}))
  }
}

beforeEach(() => {
  toast.error.mockClear()
  toast.message.mockClear()
  refreshCloudReadiness.mockClear()
})

describe('assertCloudWorkspaceReady', () => {
  it('lets Create go ahead when Vercel still has the build', async () => {
    const cloud = cloudApi('ready')
    Object.assign(window, {
      api: { vercelCloud: { status: async () => ({ state: 'connected' }) }, cloud }
    })
    await expect(assertCloudWorkspaceReady('r1')).resolves.toBeUndefined()
    expect(cloud.checkBuild).toHaveBeenCalledWith('r1')
  })

  it('stops before a sandbox starts when the build expired, and offers Rebuild in place', async () => {
    const cloud = cloudApi('expired')
    Object.assign(window, {
      api: { vercelCloud: { status: async () => ({ state: 'connected' }) }, cloud }
    })
    await expect(assertCloudWorkspaceReady('r1')).rejects.toThrow('Rebuild it')
    expect(refreshCloudReadiness).toHaveBeenCalled()
    const action = toast.error.mock.calls[0]?.[1]?.action
    expect(action?.label).toBe('Rebuild')
    action.onClick()
    await vi.waitFor(() => expect(cloud.startBuild).toHaveBeenCalledWith('r1'))
    await vi.waitFor(() => expect(toast.message).toHaveBeenCalled())
  })
})
