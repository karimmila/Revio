import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { gitExecFileAsync } from '../command-runner/git-exec-file'
import { gitOptionsForWorktree, type GitRuntimeOptions } from '../git-runtime-options'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

/**
 * Per-turn checkpoints (checkpointer, our own code): before a chat turn, the whole
 * working tree (tracked, changed and untracked, not ignored) is written as Git objects and kept
 * at refs/<cli>-checkpoints/<session>/<time>. Saving never touches files, the index or HEAD.
 * Restoring puts HEAD, the files and the index back as they were at that checkpoint.
 */
const REF_ROOT = `refs/${FORK_CLI_COMMAND_NAME}-checkpoints`
// Older builds saved here; those checkpoints stay restorable and deletable.
const LEGACY_REF_ROOT = 'refs/orca-checkpoints'
const CHECKPOINT_EMAIL = `${FORK_CLI_COMMAND_NAME}@localhost`
const SESSION_ID = /^[\w.-]{1,128}$/

type Git = (args: string[], env?: NodeJS.ProcessEnv) => Promise<string>

function gitIn(worktreePath: string, options: GitRuntimeOptions): Git {
  return async (args, env) =>
    (
      await gitExecFileAsync(args, {
        ...gitOptionsForWorktree(worktreePath, options),
        ...(env ? { env: { ...process.env, ...env } } : {}),
        timeout: 60_000
      })
    ).stdout.trim()
}

function sessionRefs(sessionId: string, root: string = REF_ROOT): string {
  if (!SESSION_ID.test(sessionId)) {
    throw new Error('Invalid chat session id for a checkpoint.')
  }
  return `${root}/${sessionId}`
}

/** for-each-ref patterns for a chat's checkpoints, under this app's root and the older one. */
function sessionRefPatterns(sessionId: string): string[] {
  return [REF_ROOT, LEGACY_REF_ROOT].map((root) => `${sessionRefs(sessionId, root)}/`)
}

async function withTempIndex<T>(git: Git, run: (indexFile: string) => Promise<T>): Promise<T> {
  const gitDir = await git(['rev-parse', '--absolute-git-dir'])
  const dir = await mkdtemp(join(gitDir, 'orca-checkpoint-'))
  try {
    return await run(join(dir, 'index'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Saves the working tree before a turn; returns the ref, or null when there is nothing to save. */
export async function saveTurnCheckpoint(
  worktreePath: string,
  sessionId: string,
  options: GitRuntimeOptions = {},
  now = Date.now()
): Promise<string | null> {
  const git = gitIn(worktreePath, options)
  const head = await git(['rev-parse', '-q', '--verify', 'HEAD']).catch(() => '')
  // A merge in progress has an unmerged index that cannot be written as a tree.
  if (!head || (await git(['ls-files', '-u']))) {
    return null
  }
  const indexTree = await git(['write-tree'])
  const realIndex = await git(['rev-parse', '--git-path', 'index'])
  const worktreeTree = await withTempIndex(git, async (indexFile) => {
    // A copy of the real index keeps its stat cache, so only changed files are hashed again.
    await copyFile(isAbsolute(realIndex) ? realIndex : join(worktreePath, realIndex), indexFile)
    const env = { GIT_INDEX_FILE: indexFile }
    await git(['add', '-A', '--', '.'], env)
    return git(['write-tree'], env)
  })
  const commit = await git(
    [
      'commit-tree',
      worktreeTree,
      '-p',
      head,
      '-m',
      `${FORK_CLI_COMMAND_NAME} checkpoint\n\nhead ${head}\nindex ${indexTree}`
    ],
    {
      GIT_AUTHOR_NAME: FORK_PRODUCT_NAME,
      GIT_AUTHOR_EMAIL: CHECKPOINT_EMAIL,
      GIT_COMMITTER_NAME: FORK_PRODUCT_NAME,
      GIT_COMMITTER_EMAIL: CHECKPOINT_EMAIL
    }
  )
  const ref = `${sessionRefs(sessionId)}/${now}`
  await git(['update-ref', ref, commit])
  return ref
}

/**
 * Restores the newest checkpoint of this chat saved at or before `before` (a message's time, on
 * the same host's clock). Returns false when the chat has no such checkpoint.
 */
export async function restoreTurnCheckpoint(
  worktreePath: string,
  sessionId: string,
  before: number,
  options: GitRuntimeOptions = {}
): Promise<boolean> {
  const git = gitIn(worktreePath, options)
  const listed = await git([
    'for-each-ref',
    '--format=%(refname)',
    ...sessionRefPatterns(sessionId)
  ])
  const best = listed
    .split('\n')
    .map((ref) => ({ ref, at: Number(ref.split('/').pop()) }))
    .filter((entry) => Number.isFinite(entry.at) && entry.at <= before)
    .sort((a, b) => b.at - a.at)[0]
  if (!best) {
    return false
  }
  const message = await git(['log', '-1', '--format=%B', best.ref])
  const head = /^head ([0-9a-f]{7,64})$/m.exec(message)?.[1]
  const indexTree = /^index ([0-9a-f]{7,64})$/m.exec(message)?.[1]
  if (!head || !indexTree) {
    return false
  }
  if ((await git(['rev-parse', 'HEAD'])) !== head) {
    await git(['reset', '-q', '--mixed', head])
  }
  // Make every current file known to the index, so read-tree -u removes the ones the checkpoint
  // does not have, then lay down the checkpoint's files and put its index back.
  await git(['add', '-A', '--', '.'])
  await git(['read-tree', '--reset', '-u', `${best.ref}^{tree}`])
  await git(['read-tree', '--reset', indexTree])
  await git(['update-index', '-q', '--refresh']).catch(() => '')
  return true
}

const ARCHIVE_SESSION_ID = /^archive-\d{1,16}$/

/**
 * Deletes an archived workspace's checkpoint for good when its archive record is deleted. Only
 * that archive's single ref goes, compare-and-delete on the value just read, so a ref rewritten
 * in between is left alone. Returns false when there was none (or not exactly one) to delete.
 */
export async function deleteArchiveCheckpoint(
  repoPath: string,
  sessionId: string,
  options: GitRuntimeOptions = {}
): Promise<boolean> {
  if (!ARCHIVE_SESSION_ID.test(sessionId)) {
    throw new Error('Not an archive checkpoint.')
  }
  const git = gitIn(repoPath, options)
  const listed = (
    await git([
      'for-each-ref',
      '--format=%(objectname) %(refname)',
      ...sessionRefPatterns(sessionId)
    ])
  )
    .split('\n')
    .filter(Boolean)
  if (listed.length !== 1) {
    return false
  }
  const [oid, ref] = listed[0].split(' ')
  await git(['update-ref', '-d', ref, oid])
  return true
}

/**
 * Deletes every checkpoint of one chat, under this app's ref root and the older one. A chat's
 * checkpoints hold the files as they were before each message, uncommitted work included, so they
 * go when the workspace they belong to is deleted for good. Each ref is deleted against the value
 * just read. Returns how many went; an id that is not a chat session id deletes nothing.
 */
export async function deleteSessionCheckpoints(
  repoPath: string,
  sessionId: string,
  options: GitRuntimeOptions = {}
): Promise<number> {
  if (!SESSION_ID.test(sessionId) || ARCHIVE_SESSION_ID.test(sessionId)) {
    return 0
  }
  const git = gitIn(repoPath, options)
  const listed = (
    await git([
      'for-each-ref',
      '--format=%(objectname) %(refname)',
      ...sessionRefPatterns(sessionId)
    ])
  )
    .split('\n')
    .filter(Boolean)
  let deleted = 0
  for (const line of listed) {
    const [oid, ref] = line.split(' ')
    await git(['update-ref', '-d', ref, oid])
    deleted += 1
  }
  return deleted
}
