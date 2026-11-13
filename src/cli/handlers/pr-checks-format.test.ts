import { expect, it } from 'vitest'
import { formatPrChecks } from './pr'

it('prints one line per check, then each failing check with its steps and log', () => {
  const text = formatPrChecks({
    url: 'https://github.com/acme/app/pull/7',
    number: 7,
    branch: 'feature/login',
    checks: [
      { name: 'build', state: 'passed', url: 'https://github.com/acme/app/runs/1' },
      { name: 'test', state: 'failed', url: null }
    ],
    failing: [
      {
        name: 'test',
        url: 'https://github.com/acme/app/runs/2',
        summary: 'Tests failed',
        annotations: ['src/login.ts:12: Expected 2 to be 3'],
        jobs: [{ name: 'unit', failedSteps: ['Run tests'], log: 'FAIL login.test.ts' }]
      }
    ],
    failingOmitted: 1
  })

  expect(text.split('\n')).toEqual([
    'Pull request #7 for feature/login: https://github.com/acme/app/pull/7',
    '2 checks: 1 failed, 0 running, 1 passed, 0 skipped.',
    'passed\tbuild\thttps://github.com/acme/app/runs/1',
    'failed\ttest',
    '',
    '=== test (https://github.com/acme/app/runs/2) ===',
    'Tests failed',
    'src/login.ts:12: Expected 2 to be 3',
    '--- job: unit ---',
    'failed steps: Run tests',
    'FAIL login.test.ts',
    '',
    '1 more failing checks are listed above without their logs.'
  ])
})

it('says when no checks have run yet', () => {
  expect(
    formatPrChecks({
      url: 'https://github.com/acme/app/pull/7',
      number: 7,
      branch: 'b',
      checks: []
    })
  ).toBe(
    'Pull request #7 for b: https://github.com/acme/app/pull/7\nNo checks have run on this pull request yet.'
  )
})
