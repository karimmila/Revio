import { describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock('./github-app-session', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  githubAccessToken: session.token
}))

import { createGithubAppAuthProvider } from './github-app-auth-provider'
import { GithubSignInRequired } from './github-app-session'

describe('GitHub App auth provider', () => {
  it('turns a missing sign-in into the runner sign-in error', async () => {
    session.token.mockRejectedValueOnce(new GithubSignInRequired('Sign in with GitHub'))
    await expect(createGithubAppAuthProvider().token()).rejects.toMatchObject({
      code: 'REVIO_GITHUB_SIGN_IN_REQUIRED',
      message: 'Sign in with GitHub'
    })
  })

  it('passes other failures through, so an offline refresh reads as a network error', async () => {
    session.token.mockRejectedValueOnce(new Error('GitHub could not be reached'))
    const error = await createGithubAppAuthProvider()
      .token()
      .catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: unknown }).code).toBeUndefined()
  })
})
