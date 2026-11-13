// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { NewWorkspaceDraft } from '@/store/slices/ui/ui-slice-contract-core'
import { getDefaultSettings } from '../../../../shared/constants'
import type { Repo } from '../../../../shared/repo-types'
import { EMPTY_RETIRED_NAME_REGISTRY } from '../../../../shared/worktree/retired-name-registry'
import { projectHostSetupProjectionFromRepos } from '../../../../shared/project-host-setup-projection'
import { notePickedProject, rememberCreateRepo } from '@/lib/revio-create-default-repo'
import * as decisions from './composer-decisions'
import { useComposerTargetState } from './composer-target-state'

const originalState = useAppStore.getState()
let originalApi: PropertyDescriptor | undefined

function repo(id: string, path: string, overrides: Partial<Repo> = {}): Repo {
  return { id, path, displayName: id, badgeColor: '', addedAt: 0, kind: 'folder', ...overrides }
}

const home = repo('home', '/Users/me', { displayName: '~' })
const alpha = repo('alpha', '/Users/me/code/alpha')
const beta = repo('beta', '/Users/me/code/beta')

function draftFor(repoId: string): NewWorkspaceDraft {
  const setups = projectHostSetupProjectionFromRepos(useAppStore.getState().repos).setups
  const setup = setups.find((entry) => entry.repoId === repoId)
  return {
    repoId,
    projectId: setup?.projectId ?? null,
    hostId: setup?.hostId ?? null,
    projectHostSetupId: setup?.id ?? null,
    name: '',
    prompt: '',
    note: '',
    attachments: [],
    linkedWorkItem: null,
    agent: 'claude',
    linkedIssue: '',
    linkedPR: null
  }
}

function seedStore({
  repos,
  revioLayout = true,
  activeRepoId = 'home',
  draft = null
}: {
  repos: Repo[]
  revioLayout?: boolean
  activeRepoId?: string | null
  draft?: string | null
}): void {
  const projection = projectHostSetupProjectionFromRepos(repos)
  useAppStore.setState({
    settings: { ...getDefaultSettings('/Users/me'), revioLayout },
    repos,
    projects: [...projection.projects],
    projectHostSetups: [...projection.setups],
    projectGroups: [],
    activeRepoId,
    newWorkspaceDraft: null,
    worktreesByRepo: {},
    sparsePresetsByRepo: {},
    workspaceHostScope: 'all',
    detectedAgentIds: []
  })
  if (draft) {
    useAppStore.setState({ newWorkspaceDraft: draftFor(draft) })
  }
}

function openedRepoId(options: { persistDraft?: boolean; initialRepoId?: string } = {}): string {
  const { result } = renderHook(() =>
    useComposerTargetState({ persistDraft: options.persistDraft ?? true, ...options }, decisions)
  )
  return result.current.initialTargetState.resolvedInitialRepoId
}

beforeEach(() => {
  originalApi = Object.getOwnPropertyDescriptor(window, 'api')
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      preflight: {
        detectAgents: vi.fn<Window['api']['preflight']['detectAgents']>().mockResolvedValue([])
      },
      worktrees: {
        listRetiredNames: vi
          .fn<Window['api']['worktrees']['listRetiredNames']>()
          .mockResolvedValue(EMPTY_RETIRED_NAME_REGISTRY)
      }
    }
  })
  window.localStorage.clear()
  // A create clears any earlier home-folder pick.
  rememberCreateRepo(home)
})

afterEach(() => {
  cleanup()
  useAppStore.setState(originalState, true)
  window.localStorage.clear()
  if (originalApi) {
    Object.defineProperty(window, 'api', originalApi)
  } else {
    Reflect.deleteProperty(window, 'api')
  }
})

describe('Create never defaults to the home folder', () => {
  it('opens on the last real project when the active workspace is in "~"', () => {
    seedStore({ repos: [home, alpha, beta] })
    rememberCreateRepo(beta)
    expect(openedRepoId()).toBe('beta')
  })

  it('opens on the first real project when none was created in yet', () => {
    seedStore({ repos: [home, alpha, beta] })
    expect(openedRepoId()).toBe('alpha')
  })

  it('replaces a "~" draft that the person did not pick', () => {
    seedStore({ repos: [home, alpha, beta], activeRepoId: null, draft: 'home' })
    expect(openedRepoId()).toBe('alpha')
  })

  it('keeps "~" when its own "+" opened Create on it', () => {
    seedStore({ repos: [home, alpha, beta], activeRepoId: null })
    expect(openedRepoId({ initialRepoId: 'home' })).toBe('home')
  })

  it('keeps "~" when the person picked it in the project picker', () => {
    seedStore({ repos: [home, alpha, beta], draft: 'home' })
    rememberCreateRepo(beta)
    notePickedProject(home)
    expect(openedRepoId()).toBe('home')
  })

  it('shows "~" when it is the only project', () => {
    seedStore({ repos: [home] })
    expect(openedRepoId()).toBe('home')
  })

  it('leaves the classic layout as it was', () => {
    seedStore({ repos: [home, alpha, beta], revioLayout: false })
    rememberCreateRepo(beta)
    expect(openedRepoId()).toBe('home')
  })
})
