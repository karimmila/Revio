import { runProcess } from '@orca/process-host'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import { parseGithubRemote, type GithubRepoRef } from '../../shared/cloud/github-remote'

async function run(program: string, args: string[], timeoutMs = 15_000): Promise<string> {
  const result = await runProcess({
    program: resolveSelectedLocalCommand(program, { env: process.env }),
    args,
    env: process.env,
    timeoutMs,
    maxOutputBytes: 64 * 1024
  })
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `${program} exited ${result.code}`)
  }
  return result.stdout
}

export type GithubRepo = GithubRepoRef
export { parseGithubRemote }

export async function githubRepoOf(repoPath: string): Promise<GithubRepo | null> {
  try {
    return parseGithubRemote(await run('git', ['-C', repoPath, 'remote', 'get-url', 'origin']))
  } catch {
    return null
  }
}

export { GH_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-github-placeholder'

/**
 * Brings `origin/<branch>` up to date before a cloud workspace branches from it, as the workspace
 * layout branches from the remote tip. Bounded and never fatal: offline, Orca uses the ref it has.
 */
/** The remote branch behind a base ref: Orca hands over `refs/heads/<b>` or `origin/<b>`. */
export function remoteBranchOfRef(ref: string | undefined): string | null {
  return /^(?:origin\/|refs\/heads\/)(.+)$/.exec(ref ?? '')?.[1] ?? null
}

export async function fetchRemoteBase(repoPath: string, ref: string): Promise<void> {
  const branch = remoteBranchOfRef(ref)
  if (!branch) {
    return
  }
  await run(
    'git',
    [
      '-C',
      repoPath,
      'fetch',
      '--quiet',
      'origin',
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`
    ],
    20_000
  ).catch(bestEffort(`Fetching the base branch (${FORK_PRODUCT_NAME} uses the ref it has)`))
}

export function cloneUrl(repo: GithubRepo): string {
  return `https://github.com/${repo.owner}/${repo.name}.git`
}

export {
  ALLOWLIST_DOMAINS,
  DEFAULT_SANDBOX_NETWORK,
  GITHUB_RELEASE_DOWNLOAD_PATH,
  githubApiPathPatterns,
  isAllowedDomainEntry,
  sandboxNetworkPolicy,
  type SandboxNetwork
} from './cloud-network-policy'
import { bestEffort } from './cloud-log'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
