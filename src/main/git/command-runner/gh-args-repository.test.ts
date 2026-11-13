import { describe, expect, it } from 'vitest'
import { ghArgsRepository } from './gh-args-repository'

const WIDGETS = { host: null, owner: 'acme', name: 'widgets' }

describe('ghArgsRepository', () => {
  it.each([
    [['pr', 'list', '--repo', 'acme/widgets'], WIDGETS],
    [['pr', 'view', '-R', 'github.com/acme/widgets'], { ...WIDGETS, host: 'github.com' }],
    [['issue', 'list', '--repo=acme/widgets'], WIDGETS],
    [['api', '--hostname', 'github.com', 'repos/acme/widgets/pulls?state=open'], WIDGETS],
    [['api', '/repos/acme/widgets/actions/jobs/1/logs'], WIDGETS],
    [['api', 'graphql', '-f', 'query=query{}', '-F', 'owner=acme', '-f', 'repo=widgets'], WIDGETS]
  ])('reads the repository from %j', (args, expected) => {
    expect(ghArgsRepository(args)).toEqual(expected)
  })

  it.each([
    [['api', 'user']],
    [['pr', 'view', '12']],
    [['api', 'graphql', '-f', 'query={viewer{login}}']]
  ])('returns null when the cwd remote decides: %j', (args) => {
    expect(ghArgsRepository(args)).toBeNull()
  })
})
