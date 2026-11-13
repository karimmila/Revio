import { ghExecFileAsync, type LocalGitExecOptions } from '../../gh-utils'
import { resolveGitHubRepoExecution, type GitHubApiRepository } from '../../github-api-repository'

/** The PR's markdown description, for the inline edit in the Checks tab; null when unreadable. */
export async function getPRBody(
  repoPath: string,
  prNumber: number,
  connectionId?: string | null,
  prRepo?: GitHubApiRepository | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<string | null> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    repoPath,
    prRepo,
    connectionId,
    localGitOptions
  )
  if (!ownerRepo) {
    return null
  }
  try {
    const { stdout } = await ghExecFileAsync(
      [
        'pr',
        'view',
        String(prNumber),
        '--json',
        'body',
        '--jq',
        '.body',
        '--repo',
        `${ownerRepo.owner}/${ownerRepo.repo}`
      ],
      ghOptions
    )
    return stdout.replace(/\n$/, '')
  } catch {
    return null
  }
}
