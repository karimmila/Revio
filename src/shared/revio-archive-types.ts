/** A chat the workspace had when archived, resumed in a chat tab on Unarchive. */
export type ArchivedChat = {
  /** The chat's agent (a TuiAgent id). */
  agent: string
  /** Orca's chat session id. Its record outlives the archive, so Unarchive reopens it by this id. */
  sessionId?: string
  /** Claude's session id or Codex's thread id, for a chat that cannot be reopened by its id. */
  providerSessionId?: string
  /** The name the chat was given, when it had one. */
  title?: string
}

/**
 * A workspace archived in the workspace layout: its worktree is gone, this record lets it return.
 */
export type ArchivedWorkspace = {
  /** The worktree id it had, `repoId::path`. */
  id: string
  repoId: string
  displayName: string
  /** Branch name without refs/heads/, or null when it was detached. */
  branch: string | null
  /** HEAD when archived (archive_commit). */
  archiveCommit: string
  archivedAt: number
  cloud: boolean
  /** Checkpoint session holding the uncommitted and untracked work at archive time (local only). */
  checkpointSession?: string
  /**
   * Checkpoint sessions of this workspace's earlier archives (local only). Unarchive leaves a
   * checkpoint under its ref, so a workspace archived again still owns the earlier ones; Delete
   * removes them with the newest.
   */
  earlierCheckpointSessions?: string[]
  /** Its chats; records written before chats were kept have none. */
  chats?: ArchivedChat[]
  /**
   * A cloud workspace archived while its sandbox slept: the project the new sandbox joins and the
   * stop snapshot kept to restore it (null when Vercel had none; Unarchive then starts from the
   * build and the branch). `repoId` is then the repository on this Mac.
   */
  cloudRestore?: { projectId: string; snapshotId: string | null }
}
