/** Where Settings > Git > "Open pull requests in" sends a PR link. `app` is the fork's own Orca browser tab. */
export type RevioPrOpenTarget = 'github' | 'linear' | 'graphite' | 'app'

const GITHUB_PREFIX = 'https://github.com/'
const GITHUB_PR = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/

/** Rewrites a GitHub PR URL for Linear's or Graphite's review page; other hosts keep their link. */
export function revioPullRequestUrl(url: string, target: RevioPrOpenTarget): string {
  if (!url.startsWith(GITHUB_PREFIX)) {
    return url
  }
  if (target === 'linear') {
    return `https://linear.review/${url.slice(GITHUB_PREFIX.length)}`
  }
  if (target === 'graphite') {
    return url.replace(GITHUB_PR, 'https://app.graphite.com/github/pr/$1/$2/$3')
  }
  return url
}
