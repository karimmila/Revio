import { realpath } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { gitExecFileAsync } from '../git/runner'
import type { WorkspaceImportGit } from './workspace-import-project'

// Read-only callers must not refresh an index they do not own (the source app's mirrors).
const READ_ONLY_ENV = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
const LARGE_OUTPUT = 512 * 1024 * 1024

export async function git(cwd: string, args: string[], stdin?: string): Promise<string> {
  const { stdout } = await gitExecFileAsync(args, {
    cwd,
    env: READ_ONLY_ENV,
    maxBuffer: LARGE_OUTPUT,
    ...(stdin === undefined ? {} : { stdin })
  })
  return stdout
}

async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
  try {
    return (await git(cwd, args)).trim()
  } catch {
    return null
  }
}

async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch {
    return path
  }
}

export const workspaceImportGit: WorkspaceImportGit = {
  // Only the root of a checkout counts; a folder nested inside some other repository does not.
  commonDir: async (path) => {
    const top = await gitOrNull(path, ['rev-parse', '--show-toplevel'])
    if (!top || (await canonical(top)) !== (await canonical(path))) {
      return null
    }
    const common = await gitOrNull(path, ['rev-parse', '--git-common-dir'])
    if (!common) {
      return null
    }
    return canonical(isAbsolute(common) ? common : resolve(path, common))
  },
  hasLocalBranch: async (repoPath, branch) =>
    (await gitOrNull(repoPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])) !==
    null,
  fetchRemoteBranch: async (repoPath, branch) => {
    const listed = await gitOrNull(repoPath, ['ls-remote', '--heads', 'origin', branch])
    if (!listed) {
      return false
    }
    return (
      (await gitOrNull(repoPath, [
        'fetch',
        '--no-tags',
        'origin',
        `+refs/heads/${branch}:refs/remotes/origin/${branch}`
      ])) !== null
    )
  }
}
