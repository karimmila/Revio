import { expect, it, vi } from 'vitest'

vi.mock('../runner', () => ({ gitExecFileAsync: vi.fn(), commandExecFileAsync: vi.fn() }))

import { graphiteStateFromMetadata } from './graphite-branch-metadata'
import { buildGraphiteStack } from './graphite-stack'

it('builds the gt state shape from refs/branch-metadata, so the stack shows without gt', () => {
  const state = graphiteStateFromMetadata(
    new Map([
      ['feat/a', JSON.stringify({ parentBranchName: 'main', parentBranchRevision: 'x' })],
      ['feat/b', JSON.stringify({ parentBranchName: 'feat/a' })],
      ['broken', 'not json']
    ])
  )
  expect(buildGraphiteStack(state, 'feat/a')?.branches.map((branch) => branch.name)).toEqual([
    'feat/b',
    'feat/a',
    'main'
  ])
  expect(buildGraphiteStack(state, 'main')).toBeNull()
})
