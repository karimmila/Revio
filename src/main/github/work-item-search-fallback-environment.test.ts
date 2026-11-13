import { expect, it } from 'vitest'
import { api } from './work-item-search-test-harness'
import { countWorkItems } from './client/list/count-work-items'

it('preserves the Search budget floor when the preferred count fails', async () => {
  api.restSearches = 29
  api.aliasErrorRepo = 'fixture/repo'

  expect(await countWorkItems('fixture/repo', 'is:issue')).toBe(0)
  expect(api.calls.some((call) => call.args.includes('graphql'))).toBe(true)
  expect(api.calls.some((call) => call.args.some((arg) => arg.startsWith('search/issues?')))).toBe(
    false
  )
  expect(api.restSearches).toBe(29)
})
