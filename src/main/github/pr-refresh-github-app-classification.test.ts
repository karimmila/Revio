import { describe, expect, it } from 'vitest'
import {
  GithubAppNotInstalledError,
  GithubAppSignInRequiredError
} from '../git/command-runner/github-app-auth'
import { prRefreshUpstreamError } from './client/gh-error-predicates'
import { classifyCreatePRError } from './client/create/create-pr-error-classification'

describe('GitHub App states in pull request refresh', () => {
  it('reports a missing sign-in as its own state, not a gh login problem', () => {
    const outcome = prRefreshUpstreamError(new GithubAppSignInRequiredError())
    expect(outcome.errorType).toBe('github_sign_in')
    expect(outcome.message).not.toMatch(/gh (auth|login)/)
  })

  it('names the owner to install the app on', () => {
    const outcome = prRefreshUpstreamError(new GithubAppNotInstalledError('acme'))
    expect(outcome).toMatchObject({ errorType: 'app_not_installed', installOwner: 'acme' })
    expect(outcome.message).toMatch(/Install .* on acme/)
  })

  it('tells Create PR to sign in with the app, not to run gh auth login', () => {
    const result = classifyCreatePRError(new GithubAppSignInRequiredError())
    expect(result).toMatchObject({ ok: false, code: 'auth_required' })
    expect(result.ok ? '' : result.error).not.toContain('gh auth login')
  })
})
