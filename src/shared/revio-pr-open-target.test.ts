import { describe, expect, it } from 'vitest'
import { revioPullRequestUrl } from './revio-pr-open-target'

const PR = 'https://github.com/acme/web/pull/42'

describe('revioPullRequestUrl', () => {
  it('keeps the GitHub link for GitHub and the Orca tab', () => {
    expect(revioPullRequestUrl(PR, 'github')).toBe(PR)
    expect(revioPullRequestUrl(PR, 'app')).toBe(PR)
  })

  it('opens Linear reviews at linear.review', () => {
    expect(revioPullRequestUrl(PR, 'linear')).toBe('https://linear.review/acme/web/pull/42')
  })

  it('opens Graphite at its PR page and drops the GitHub suffix', () => {
    expect(revioPullRequestUrl(`${PR}/files#diff`, 'graphite')).toBe(
      'https://app.graphite.com/github/pr/acme/web/42'
    )
  })

  it('leaves links from other hosts alone', () => {
    const gitlab = 'https://gitlab.com/acme/web/-/merge_requests/3'
    expect(revioPullRequestUrl(gitlab, 'linear')).toBe(gitlab)
    expect(revioPullRequestUrl(gitlab, 'graphite')).toBe(gitlab)
  })
})
