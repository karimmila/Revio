// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CloudGithubEvent } from '../../../../../shared/cloud/cloud-types'

const sonner = vi.hoisted(() => ({ warning: vi.fn(), dismiss: vi.fn() }))
vi.mock('sonner', () => ({ toast: sonner }))

import { GithubExpiredToastHost } from './GithubExpiredToastHost'

let emit: (event: CloudGithubEvent) => void = () => undefined
const githubStatus = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  githubStatus.mockResolvedValue({ account: null })
  Object.assign(window, {
    api: {
      cloud: {
        githubStatus,
        onGithubEvent: (listener: (event: CloudGithubEvent) => void) => {
          emit = listener
          return () => undefined
        }
      }
    }
  })
})
afterEach(cleanup)

it('warns once when the sign-in expires, and clears the warning after the next sign-in', async () => {
  render(<GithubExpiredToastHost />)
  emit({ error: null })
  expect(sonner.warning).not.toHaveBeenCalled()
  emit({ error: null, expired: true })
  expect(sonner.warning).toHaveBeenCalledOnce()
  expect(sonner.warning.mock.calls[0][0]).toMatch(/GitHub access expired/)
  githubStatus.mockResolvedValue({ account: { login: 'octo' } })
  emit({ error: null })
  await waitFor(() => expect(sonner.dismiss).toHaveBeenCalledWith('cloud-github-expired'))
})
