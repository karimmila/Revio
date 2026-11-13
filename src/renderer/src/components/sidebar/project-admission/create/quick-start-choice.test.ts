import { describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, text: string) => text }))

import type { QuickStartResult } from '../../../../../../shared/quick-start-types'
import { runQuickStartChoice, setQuickStartChoice } from './quick-start-choice'

describe('runQuickStartChoice', () => {
  it('sends the chosen template once and then resets', async () => {
    const quickStart = vi.fn(async (): Promise<QuickStartResult> => ({ ok: true }))
    vi.stubGlobal('window', { api: { githubRepos: { quickStart } } })
    setQuickStartChoice({ template: 'empty', publishToGithub: false })
    await runQuickStartChoice('/p/demo', 'demo')
    await runQuickStartChoice('/p/demo', 'demo')
    expect(quickStart).toHaveBeenCalledTimes(1)
    expect(quickStart).toHaveBeenCalledWith({
      repoPath: '/p/demo',
      name: 'demo',
      template: 'empty',
      publishToGithub: false
    })
    vi.unstubAllGlobals()
  })
})
