import { invalidateReviewLookupsAfterPRMutation } from '../../pr-mutation-review-invalidation'
import { ghExecFileAsync, acquire, release, type LocalGitExecOptions } from '../../gh-utils'
import { resolveGitHubRepoExecution, type GitHubApiRepository } from '../../github-api-repository'
import { codeHostFailure } from '../../../../shared/code-host-failure-copy'

/** `gh pr review --approve` arguments; the repository is always named so a fork never wins. */
export function approvePRArgs(repository: GitHubApiRepository, prNumber: number): string[] {
  return [
    'pr',
    'review',
    String(prNumber),
    '--approve',
    '--repo',
    `${repository.owner}/${repository.repo}`
  ]
}

/** "Approve PR": an approving review with no body, as the gh user. */
export async function approvePR(
  repoPath: string,
  prNumber: number,
  connectionId?: string | null,
  prRepo?: GitHubApiRepository | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    repoPath,
    prRepo,
    connectionId,
    localGitOptions
  )
  if (!ownerRepo) {
    return codeHostFailure('github.repoUnresolved')
  }
  await acquire()
  try {
    await ghExecFileAsync(approvePRArgs(ownerRepo, prNumber), {
      ...ghOptions,
      env: { ...process.env, GH_PROMPT_DISABLED: '1' }
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    invalidateReviewLookupsAfterPRMutation(repoPath, connectionId)
    release()
  }
}
