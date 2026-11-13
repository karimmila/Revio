import { describe, expect, it } from 'vitest'
import type { PRCheckDetail } from '../../../../shared/github/check-types'
import { deploymentTone, failedCheckCount } from './revio-checks-extras'

function check(conclusion: PRCheckDetail['conclusion']): PRCheckDetail {
  return { name: 'ci', status: 'completed', conclusion, url: null }
}

describe('Checks extras', () => {
  it('counts the checks a failed-only rerun restarts', () => {
    expect(
      failedCheckCount([check('failure'), check('cancelled'), check('success'), check('timed_out')])
    ).toBe(3)
  })

  it('maps GitHub deployment states to the layout labels', () => {
    const tone = (state: string) =>
      deploymentTone({ id: 1, environment: 'preview', state, url: null, createdAt: '' })
    expect(tone('success')).toBe('deployed')
    expect(tone('error')).toBe('failed')
    expect(tone('in_progress')).toBe('deploying')
    expect(tone('queued')).toBe('pending')
    expect(tone('inactive')).toBe('inactive')
  })
})
