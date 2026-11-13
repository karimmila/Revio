import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimes = vi.hoisted(() => {
  const list: Record<string, unknown>[] = []
  const updates: unknown[] = []
  return { list, updates }
})
const sandboxStatus = vi.hoisted(() => ({ value: 'running' }))
const disconnected = vi.hoisted(() => {
  const ids: unknown[] = []
  return ids
})
const sandboxIdle = vi.hoisted(() => ({ output: '', stops: 0 }))
const hangGets = vi.hoisted(() => {
  const signals: (AbortSignal | undefined)[] = []
  return { count: 0, signals }
})
const goneGets = vi.hoisted(() => ({ count: 0 }))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: vi.fn(async (params: { signal?: AbortSignal }) => {
      hangGets.signals.push(params.signal)
      if (goneGets.count > 0) {
        goneGets.count -= 1
        throw Object.assign(new Error('Status code 404 is not ok'), { status: 404 })
      }
      if (hangGets.count > 0) {
        hangGets.count -= 1
        return new Promise(() => undefined)
      }
      return sandboxWith()
    })
  }
}))

function sandboxWith(): Record<string, unknown> {
  return {
    status: sandboxStatus.value,
    stop: async () => {
      sandboxIdle.stops += 1
    }
  }
}
vi.mock('./cloud-sandbox-run', () => ({
  runSandboxScript: vi.fn(async () => sandboxIdle.output)
}))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: vi.fn(async () => ({ token: 't', teamId: 'team', projectId: 'p' }))
}))
vi.mock('../ephemeral-vm/runtime-ssh', () => ({
  disconnectRuntimeOwnedSshTarget: vi.fn(async (id: unknown) => {
    disconnected.push(id)
  })
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => runtimes.list,
  updateEphemeralVmRuntimeStatus: (_root: string, id: string, patch: unknown) => {
    runtimes.updates.push({ id, patch })
  }
}))

import { reportCloudActivity } from './cloud-idle'
import { reconcileCloudSessions, startCloudSessionWatch } from './cloud-session-watch'

function runtime(id: string, recipeId: string, status: string): Record<string, unknown> {
  return {
    id,
    recipeId,
    status,
    runtimeEnvironmentId: `env-${id}`,
    sshTargetId: `runtime-ssh-${id}`,
    recipeResult: { userData: { sandboxName: `sb-${id}` } }
  }
}

describe('reconcileCloudSessions', () => {
  beforeEach(() => {
    runtimes.updates.length = 0
    disconnected.length = 0
    runtimes.list = [
      runtime('cloud-1', 'orca-cloud-vercel', 'running'),
      runtime('cloud-2', 'orca-cloud-vercel', 'suspended'),
      runtime('other', 'team-vm', 'running')
    ]
  })

  it('records a sandbox Vercel stopped on its own as suspended, so opening it resumes', async () => {
    sandboxStatus.value = 'stopped'
    expect(await reconcileCloudSessions('/data')).toEqual(['cloud-1'])
    expect(runtimes.updates).toEqual([{ id: 'cloud-1', patch: { status: 'suspended' } }])
    expect(disconnected).toEqual(['runtime-ssh-cloud-1'])
  })

  it('leaves running sandboxes and other recipes alone', async () => {
    sandboxStatus.value = 'running'
    expect(await reconcileCloudSessions('/data')).toEqual([])
    expect(runtimes.updates).toEqual([])
  })

  describe('idle sleep', () => {
    const start = new Date('2026-11-08T04:00:00Z').getTime()
    // `date +%s`, the newest pty write, and "busy" when a terminal runs a foreground job.
    const quietFor = (seconds: number, busy = ''): string =>
      `${start / 1000 + 600} ${start / 1000 + 600 - seconds} ${busy}`

    beforeEach(() => {
      sandboxStatus.value = 'running'
      sandboxIdle.stops = 0
      vi.useFakeTimers()
      vi.setSystemTime(start)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    async function passAfterMinutes(id: string, minutes: number): Promise<string[]> {
      runtimes.list = [runtime(id, 'orca-cloud-vercel', 'running')]
      await reconcileCloudSessions('/data', 1)
      vi.setSystemTime(start + minutes * 60_000)
      return reconcileCloudSessions('/data', 1)
    }

    it('stops a sandbox nobody used for the idle window and records it as suspended', async () => {
      sandboxIdle.output = quietFor(120)
      expect(await passAfterMinutes('idle', 2)).toEqual(['idle'])
      expect(sandboxIdle.stops).toBe(1)
    })

    it('never stops while a terminal runs a foreground job such as claude -p', async () => {
      sandboxIdle.output = quietFor(120, 'busy')
      expect(await passAfterMinutes('agent', 2)).toEqual([])
      expect(sandboxIdle.stops).toBe(0)
    })

    it('keeps the workspace the renderer reports as open or working awake', async () => {
      sandboxIdle.output = quietFor(120)
      runtimes.list = [runtime('open', 'orca-cloud-vercel', 'running')]
      await reconcileCloudSessions('/data', 1)
      vi.setSystemTime(start + 2 * 60_000)
      reportCloudActivity(['env-open'])
      expect(await reconcileCloudSessions('/data', 1)).toEqual([])
      expect(sandboxIdle.stops).toBe(0)
    })

    it('does nothing when idle sleep is off', async () => {
      sandboxIdle.output = quietFor(3600)
      runtimes.list = [runtime('off', 'orca-cloud-vercel', 'running')]
      vi.setSystemTime(start + 120 * 60_000)
      expect(await reconcileCloudSessions('/data', 0)).toEqual([])
      expect(sandboxIdle.stops).toBe(0)
    })
  })

  it('keeps watching after a pass hangs, so a stopped sandbox is still marked suspended', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    sandboxStatus.value = 'stopped'
    hangGets.count = 1
    const stop = startCloudSessionWatch(
      () => '/data',
      () => 0
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(runtimes.updates).toEqual([])
    await vi.advanceTimersByTimeAsync(45_000)
    expect(warn).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(runtimes.updates).toEqual([{ id: 'cloud-1', patch: { status: 'suspended' } }])
    stop()
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('aborts a hung pass’s Vercel calls and starts the next only after it settled', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    sandboxStatus.value = 'running'
    hangGets.count = 1
    hangGets.signals.length = 0
    const stop = startCloudSessionWatch(
      () => '/data',
      () => 0
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(hangGets.signals).toHaveLength(1)
    expect(hangGets.signals[0]?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(45_000)
    expect(hangGets.signals[0]?.aborted).toBe(true)
    expect(warn.mock.calls.flat().join(' ')).toMatch(/Session watch pass failed/)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(hangGets.signals).toHaveLength(2)
    stop()
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('treats a sandbox Vercel answers 404 for as gone, without reading the message', async () => {
    runtimes.updates.length = 0
    goneGets.count = 1
    expect(await reconcileCloudSessions('/data')).toEqual(['cloud-1'])
    expect(runtimes.updates).toEqual([{ id: 'cloud-1', patch: { status: 'suspended' } }])
  })
})
