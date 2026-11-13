import { z } from 'zod'

export type GithubRepoSummary = { nameWithOwner: string; url: string; isPrivate: boolean }

const githubRepoRowSchema = z.object({
  nameWithOwner: z.string(),
  url: z.string(),
  isPrivate: z.unknown().optional()
})

/** Parses `gh repo list --json nameWithOwner,url,isPrivate` output, skipping malformed rows. */
export function parseGithubRepoList(stdout: string): GithubRepoSummary[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.flatMap((row: unknown): GithubRepoSummary[] => {
    const result = githubRepoRowSchema.safeParse(row)
    return result.success
      ? [
          {
            nameWithOwner: result.data.nameWithOwner,
            url: result.data.url,
            isPrivate: result.data.isPrivate === true
          }
        ]
      : []
  })
}

export function filterGithubRepos(
  repos: readonly GithubRepoSummary[],
  query: string,
  limit = 8
): GithubRepoSummary[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return repos
    .filter((repo) => words.every((word) => repo.nameWithOwner.toLowerCase().includes(word)))
    .slice(0, limit)
}
