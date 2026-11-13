import { expect, it } from 'vitest'
import { createWorkspacePortAllocator, defaultBranchName } from './workspace-port-allocation'

it('gives each workspace its own block of ten from 55000, stable while running', () => {
  const portFor = createWorkspacePortAllocator()
  expect(portFor('/a')).toBe(55_000)
  expect(portFor('/b')).toBe(55_010)
  expect(portFor('/a')).toBe(55_000)
  expect(portFor('/c')).toBe(55_020)
})

it('names the target branch without its remote', () => {
  expect(defaultBranchName('origin/main')).toBe('main')
  expect(defaultBranchName('refs/remotes/origin/release/1.0')).toBe('release/1.0')
  expect(defaultBranchName('develop')).toBe('develop')
  expect(defaultBranchName(undefined)).toBeNull()
})
