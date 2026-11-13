export type ImportSourceChatAgent = 'claude' | 'codex'

export type ImportSourceChat = {
  sourceId: string
  agent: ImportSourceChatAgent
  /** The CLI's own session id, which a resumed chat continues. */
  providerSessionId: string
  title: string
  model: string | null
  lastActivityAt: string | null
}

export type ImportSourceWorkspace = {
  sourceId: string
  repoName: string
  repoRemoteUrl: string | null
  repoRootPath: string | null
  name: string
  path: string
  branch: string | null
  baseBranch: string | null
  archived: boolean
  /** A cloud workspace's files reach this Mac only through the source app's local mirror. */
  cloud: boolean
  /**
   * Where the source app keeps a cloud workspace's mirror checkout. Detection only names the
   * place; whether a mirror is there is looked up when the import runs.
   */
  mirrorPath: string | null
  lastActivityAt: string | null
  chats: ImportSourceChat[]
}

export type ImportSourceRepoScripts = {
  repoName: string
  setup: string | null
  run: string | null
  runMode: 'concurrent' | 'nonconcurrent'
}

export type WorkspaceImportSummary = {
  repoNames: string[]
  active: { workspaces: number; chats: number }
  archived: { workspaces: number; chats: number }
  /** Counts what a run would still add; already imported items are left out. */
  pending: {
    active: { workspaces: number; chats: number }
    archived: { workspaces: number; chats: number }
  }
  /** Some active workspaces are cloud ones, whose uncommitted changes the source app mirrors. */
  hasMirroredChanges: boolean
}

/**
 * What the import reads from the repositories once the person has pressed Import; detection
 * itself never opens a repository folder.
 */
export type WorkspaceImportPreparation = {
  /**
   * Scripts read from a settings file the repository commits. They came with the code, so the
   * person sees each one and approves it before it is stored; `hash` names what was shown.
   */
  repositoryScripts: WorkspaceImportRepositoryScripts[]
}

export type WorkspaceImportDetection =
  | { found: false }
  | { found: true; summary: WorkspaceImportSummary }

export type WorkspaceImportRepositoryScripts = {
  repoName: string
  setup: string | null
  run: string | null
  hash: string
}

export type WorkspaceImportOptions = {
  includeArchived: boolean
  includeScripts: boolean
  /** Hashes of the repository scripts the person approved; any other is left out. */
  approvedScriptHashes?: string[]
}

export type WorkspaceImportSkip = {
  name: string
  reason:
    | 'no-project'
    | 'worktree-failed'
    | 'transcript-missing'
    | 'chat-failed'
    | 'folder-access-denied'
  /** With `folder-access-denied`: the folder macOS did not let the app read. */
  folder?: string
}

export type WorkspaceImportResult = {
  workspaces: number
  chats: number
  skipped: WorkspaceImportSkip[]
  /** Workspaces whose uncommitted changes did not apply and were kept in a folder of their own. */
  changesKeptAside: string[]
  /** The workspace whose chat was used last, to open after the import. */
  mostRecentWorktreeId: string | null
}

export type WorkspaceImportProgress = {
  done: number
  total: number
}
