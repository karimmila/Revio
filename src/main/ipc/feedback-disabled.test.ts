import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, handlers } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3-test' },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel))
  },
  net: { fetch: (...args: unknown[]) => fetchMock(...args) }
}))

import { registerFeedbackHandlers, submitFeedback } from './feedback'
import { FEEDBACK_DISABLED_ERROR, feedbackApiUrl } from './feedback-request'

// No mock of fork-services: this runs against the shipped fork-identity.json.
describe('feedback with no endpoint configured', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    handlers.clear()
  })

  it('has no feedback URL by default', () => {
    expect(feedbackApiUrl()).toBeNull()
  })

  it('never sends feedback, crash reports or the GitHub identity anywhere', async () => {
    const plain = await submitFeedback({
      feedback: 'hello',
      githubLogin: 'someone',
      githubEmail: 'someone@example.com'
    })
    const crash = await submitFeedback({
      feedback: 'crash',
      submissionType: 'crash',
      githubLogin: null,
      githubEmail: null,
      diagnosticBundle: { bundleSubmissionId: 'id', content: '{}', bytes: 2, spanCount: 1 }
    })
    expect(plain).toEqual({ ok: false, status: null, error: FEEDBACK_DISABLED_ERROR })
    expect(crash).toEqual({ ok: false, status: null, error: FEEDBACK_DISABLED_ERROR })
    registerFeedbackHandlers()
    await handlers.get('feedback:submit')?.(
      {},
      { feedback: 'ipc', githubLogin: null, githubEmail: null }
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
