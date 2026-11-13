import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { ProjectHostSetupResult } from '../../../../shared/project-types'
import { useAppStore } from '@/store'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

const result: ProjectHostSetupResult = {
  project: {
    id: 'project-1',
    displayName: 'app',
    badgeColor: '#000',
    sourceRepoIds: ['repo-1'],
    createdAt: 1,
    updatedAt: 1
  },
  setup: {
    id: 'setup-1',
    projectId: 'project-1',
    hostId: 'local',
    repoId: 'repo-1',
    path: '/work/app',
    displayName: 'app',
    setupState: 'ready',
    setupMethod: 'imported-existing-folder',
    createdAt: 1,
    updatedAt: 1
  },
  repo: { id: 'repo-1', path: '/work/app', displayName: 'app', badgeColor: '#000', addedAt: 1 }
}

const args = {
  projectId: 'project-1',
  hostId: 'local',
  path: '/work/app',
  setupMethod: 'imported-existing-folder'
} as const

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.stubGlobal('window', {
    api: { projects: { setupExistingFolder: vi.fn(async () => result) } }
  })
})

it('says "Project added" when a person adds a project on a host', async () => {
  await expect(useAppStore.getState().setupProjectExistingFolder(args)).resolves.toMatchObject({
    repo: { id: 'repo-1' }
  })
  expect(toast.success).toHaveBeenCalledWith('Project added', { description: 'app' })
})

it('stays quiet when a cloud workspace registers its checkout as a setup step', async () => {
  await expect(
    useAppStore.getState().setupProjectExistingFolder(args, { announce: false })
  ).resolves.toMatchObject({ repo: { id: 'repo-1' } })
  expect(useAppStore.getState().repos.map((repo) => repo.id)).toEqual(['repo-1'])
  expect(toast.success).not.toHaveBeenCalled()
})
