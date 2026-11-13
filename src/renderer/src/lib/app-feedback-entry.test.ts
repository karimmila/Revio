import { afterEach, describe, expect, it, vi } from 'vitest'

const { urls } = vi.hoisted(() => ({ urls: new Map<string, string>() }))

vi.mock('../../../shared/fork-services', () => ({
  forkServiceUrl: (name: string) => urls.get(name) ?? null
}))

import { appFeedbackEntry, openAppFeedback } from './app-feedback-entry'

describe('appFeedbackEntry', () => {
  const openUrl = vi.fn(() => Promise.resolve())

  afterEach(() => {
    urls.clear()
    openUrl.mockReset()
    vi.unstubAllGlobals()
  })

  it('hides every feedback entry point when the build names no endpoint', () => {
    const openDialog = vi.fn()
    expect(appFeedbackEntry()).toBeNull()
    expect(openAppFeedback(openDialog)).toBe(false)
    expect(openDialog).not.toHaveBeenCalled()
  })

  it('opens the issue tracker instead of the dialog when only issuesUrl is set', () => {
    urls.set('issuesUrl', 'https://github.com/example/revio/issues/new')
    vi.stubGlobal('window', { api: { shell: { openUrl } } })
    const openDialog = vi.fn()
    expect(appFeedbackEntry()).toEqual({
      kind: 'issues',
      url: 'https://github.com/example/revio/issues/new'
    })
    expect(openAppFeedback(openDialog)).toBe(true)
    expect(openUrl).toHaveBeenCalledWith('https://github.com/example/revio/issues/new')
    expect(openDialog).not.toHaveBeenCalled()
  })

  it('opens the in-app dialog when a feedback endpoint is set', () => {
    urls.set('feedbackUrl', 'https://feedback.example.test/v1/feedback')
    const openDialog = vi.fn()
    expect(openAppFeedback(openDialog)).toBe(true)
    expect(openDialog).toHaveBeenCalledOnce()
  })
})
