import {
  archiveCheckpointSessions,
  readArchivedWorkspaces,
  removeArchivedWorkspace
} from './revio-archive-store'
import type { ArchivedWorkspace } from '../../shared/revio-archive-types'
import {
  deleteArchiveCheckpoint,
  deleteSessionCheckpoints
} from '../git/checkpoints/turn-checkpoints'
import type { GitRuntimeOptions } from '../git/git-runtime-options'

/** Where a local repository's Git runs: its path and runtime options; null when unknown. */
export type ArchiveRepoGit = (repoId: string) => { path: string; options: GitRuntimeOptions } | null

/**
 * Delete for good (not Unarchive, whose restore can leave the work under its checkpoint ref):
 * every archive checkpoint of a local record goes too, the newest and those its earlier archives
 * left, and so does every per-message checkpoint of the workspace's chats, which hold its
 * uncommitted files as well. Nothing of the archived work stays behind. The branch is the
 * person's and stays. Returns the removed records.
 */
export async function deleteArchivedWorkspaceForGood(
  userDataPath: string,
  recordId: string,
  repoGit: ArchiveRepoGit
): Promise<ArchivedWorkspace[]> {
  const record = readArchivedWorkspaces(userDataPath).find((entry) => entry.id === recordId)
  const sessions = record ? archiveCheckpointSessions(record) : []
  const chatSessions = (record?.chats ?? []).flatMap((chat) =>
    chat.sessionId ? [chat.sessionId] : []
  )
  const git =
    record && !record.cloud && sessions.length + chatSessions.length > 0
      ? repoGit(record.repoId)
      : null
  if (git) {
    for (const session of sessions) {
      await deleteArchiveCheckpoint(git.path, session, git.options)
    }
    for (const session of chatSessions) {
      // One chat's refs failing to go must not keep the record, or the others, from going.
      await deleteSessionCheckpoints(git.path, session, git.options).catch((error: unknown) =>
        console.warn('[archive] Could not delete a chat checkpoint:', error)
      )
    }
  }
  return removeArchivedWorkspace(userDataPath, recordId)
}
