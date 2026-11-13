import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

/*
 * A cloud workspace's sandbox never holds the GitHub sign-in: its `gh` has only a placeholder
 * token and a firewall that passes REST calls for its own repository, while pull request lookups,
 * checks, reviews and merges need GraphQL and the real token. So GitHub calls about a cloud
 * workspace's repository run on this Mac instead, against the local repository the sandbox was
 * created from (the same GitHub repository), with the app's own sign-in.
 */

/** Methods that read the checkout itself, which exists only in the sandbox. */
const NEEDS_SANDBOX_CHECKOUT = new Set([
  'hostedReview.create',
  'hostedReview.createStacked',
  'github.uploadAttachment'
])

function isGithubMethod(method: string): boolean {
  return method.startsWith('github.') || method.startsWith('hostedReview.')
}

/**
 * The params to send to this Mac's runtime in place of the sandbox's, or null when the call
 * belongs to the sandbox. `sourceRepoId` answers which local repository an environment's cloud
 * workspace came from; null for an environment that is not a cloud sandbox.
 */
export function cloudForgeLocalParams(
  target: RuntimeClientTarget,
  method: string,
  params: unknown,
  sourceRepoId: (environmentId: string) => string | null
): { params: unknown } | null {
  if (target.kind !== 'environment' || !isGithubMethod(method)) {
    return null
  }
  if (NEEDS_SANDBOX_CHECKOUT.has(method)) {
    return null
  }
  const repoId = sourceRepoId(target.environmentId)
  if (!repoId) {
    return null
  }
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return { params }
  }
  // `repo` and `worktree` name the sandbox's repository and checkout path; here the local
  // repository stands in, and no call that survives the filter above needs the checkout.
  const { worktree: _worktree, ...rest } = { worktree: undefined, ...params }
  return { params: 'repo' in rest ? { ...rest, repo: repoId } : rest }
}
