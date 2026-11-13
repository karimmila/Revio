import { expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock(
  '@/components/right-sidebar/hosted-review/provider-actions/hosted-review-github-actions',
  () => ({ getGitHubActionTarget: () => ({ kind: 'local' }) })
)

import { reviewerCandidates } from './revio-review-actions'

const users = [
  { login: 'octocat', name: 'Mona Lisa', avatarUrl: '' },
  { login: 'hubot', name: null, avatarUrl: '' },
  { login: 'dev', name: 'Dev', avatarUrl: '' }
]

it('filters reviewers by login or name and leaves out excluded people', () => {
  expect(reviewerCandidates(users, 'mona', []).map((user) => user.login)).toEqual(['octocat'])
  expect(reviewerCandidates(users, '', ['DEV']).map((user) => user.login)).toEqual([
    'octocat',
    'hubot'
  ])
})
