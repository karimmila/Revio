// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AsleepCloudWorkspace } from '../../../shared/asleep-cloud-workspace-types'

const h = vi.hoisted((): { storeState: Record<string, unknown>; toasts: string[] } => ({
  storeState: {},
  toasts: []
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => h.storeState, subscribe: () => () => {} }
}))
vi.mock('sonner', () => ({
  toast: {
    error: (text: string) => h.toasts.push(`error:${text}`),
    warning: (text: string) => h.toasts.push(`warning:${text}`)
  }
}))
vi.mock('@/lib/workspace/creation/worktree-creation-flow', () => ({
  runBackgroundWorktreeCreation: () => 'creation-1'
}))
vi.mock('@/lib/cloud-workspace-preflight', () => ({ assertCloudWorkspaceReady: async () => {} }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))

const { wakeAsleepCloudWorkspace } = await import('./asleep-cloud-wake')
type Deps = Parameters<typeof wakeAsleepCloudWorkspace>[1] & {}

const RECORD: AsleepCloudWorkspace = {
  id: 'imp-1',
  repoId: 'repo-1',
  displayName: 'Cloud feature',
  branch: 'me/feature',
  commit: 'a'.repeat(40),
  chats: [{ agent: 'claude', providerSessionId: 'sess-1', title: 'Fix it' }],
  lastActivityAt: null
}

function deps(overrides: Partial<Deps> = {}): Deps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    assertReady: async () => {
      calls.push('ready')
    },
    prepareWake: async () => {
      calls.push('prepare')
      return RECORD
    },
    finishWake: async () => {
      calls.push('finish')
      return 'applied'
    },
    create: (request) => {
      calls.push(`create:${request.branchNameOverride}:${request.ephemeralVmRecipe?.projectId}`)
      return 'creation-1'
    },
    settled: async () => {
      calls.push('settled')
      return 'vm::/vercel/app'
    },
    resumeChats: async (worktreeId) => {
      calls.push(`chats:${worktreeId}`)
    },
    notify: (_record, changes) => {
      calls.push(`notify:${changes}`)
    },
    ...overrides
  }
}

beforeEach(() => {
  h.toasts = []
  h.storeState = {
    repos: [{ id: 'repo-1', path: '/r', displayName: 'app', badgeColor: '#000', addedAt: 0 }],
    projectHostSetups: []
  }
})

describe('waking an imported cloud workspace', () => {
  it('creates it in the cloud, resumes its chats, then lets main delete the Mac copy', async () => {
    const d = deps()
    expect(await wakeAsleepCloudWorkspace(RECORD, d)).toBe(true)
    expect(d.calls[0]).toBe('ready')
    expect(d.calls[1]).toBe('prepare')
    expect(d.calls[2]).toMatch(/^create:me\/feature:/)
    expect(d.calls.slice(3)).toEqual([
      'settled',
      'chats:vm::/vercel/app',
      'finish',
      'notify:applied'
    ])
  })

  it('stays asleep when the repository has no cloud build', async () => {
    const d = deps({
      assertReady: async () => {
        throw new Error('Build this repository for the cloud first.')
      }
    })
    expect(await wakeAsleepCloudWorkspace(RECORD, d)).toBe(false)
    expect(d.calls).toEqual([])
    // The preflight already said what to do; no second message.
    expect(h.toasts).toEqual([])
  })

  it('stops at Home with the Connect Vercel card while Vercel is not connected', async () => {
    const setActiveWorktree = vi.fn()
    h.storeState = { ...h.storeState, setActiveView: vi.fn(), setActiveWorktree }
    const { renderHook } = await import('@testing-library/react')
    const { useAsleepCloudConnectNotice } = await import('./asleep-cloud-connect-notice')
    const d = deps({ vercelConnected: async () => false })
    expect(await wakeAsleepCloudWorkspace(RECORD, d)).toBe(false)
    // Nothing started and nothing was toasted: the workspace keeps all it had.
    expect(d.calls).toEqual([])
    expect(h.toasts).toEqual([])
    expect(setActiveWorktree).toHaveBeenCalledWith(null)
    expect(renderHook(() => useAsleepCloudConnectNotice()).result.current).toBe(RECORD)
    // Connected later, the same click wakes it and the card goes.
    expect(
      await wakeAsleepCloudWorkspace(RECORD, deps({ vercelConnected: async () => true }))
    ).toBe(true)
    expect(renderHook(() => useAsleepCloudConnectNotice()).result.current).toBeNull()
  })

  it('keeps everything when the create fails or is dismissed', async () => {
    const d = deps({ settled: async () => null })
    expect(await wakeAsleepCloudWorkspace(RECORD, d)).toBe(false)
    expect(d.calls.some((call) => call === 'finish')).toBe(false)
  })

  it('starts one wake at a time', async () => {
    let release: (value: string | null) => void = () => {}
    const d = deps({ settled: () => new Promise((resolve) => (release = resolve)) })
    const first = wakeAsleepCloudWorkspace(RECORD, d)
    await vi.waitFor(() => expect(d.calls).toContain('prepare'))
    expect(await wakeAsleepCloudWorkspace(RECORD, d)).toBe(false)
    release('vm::/vercel/app')
    expect(await first).toBe(true)
  })
})
