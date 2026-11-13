import { describe, expect, it, vi } from 'vitest'
import { appReposElseGh, githubAppRepoSummaries } from './github-app-repo-list'

const GH = [
  { nameWithOwner: 'octo/from-gh', url: 'https://github.com/octo/from-gh', isPrivate: false }
]

describe('the repositories Clone offers', () => {
  it("lists the app's repositories as GitHub spells them, with their clone page", () => {
    expect(
      githubAppRepoSummaries(
        { listed: [{ owner: 'Acme', name: 'Web-App', isPrivate: true }] },
        'github.com'
      )
    ).toEqual([
      { nameWithOwner: 'Acme/Web-App', url: 'https://github.com/Acme/Web-App', isPrivate: true }
    ])
    expect(githubAppRepoSummaries({}, 'github.com')).toEqual([])
  })

  it("prefers the app's list, which needs no gh on this Mac", async () => {
    const app = [
      { nameWithOwner: 'Acme/Web-App', url: 'https://github.com/Acme/Web-App', isPrivate: true }
    ]
    const gh = vi.fn(async () => GH)
    expect(await appReposElseGh(async () => app, gh)).toEqual(app)
    expect(gh).not.toHaveBeenCalled()
  })

  it('falls back to gh while signed out of the app, and to nothing without either', async () => {
    const signedOut = async (): Promise<never> => {
      throw new Error('Sign in with GitHub')
    }
    expect(await appReposElseGh(signedOut, async () => GH)).toEqual(GH)
    expect(await appReposElseGh(async () => [], signedOut)).toEqual([])
  })
})
