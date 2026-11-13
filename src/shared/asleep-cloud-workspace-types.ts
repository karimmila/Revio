/**
 * A cloud workspace brought over from another app that has no sandbox yet. It sits in the
 * sidebar's Cloud list as asleep; opening it starts the sandbox from the repository's build, on
 * its branch and commit, with its uncommitted work and chats.
 */
export type AsleepCloudWorkspace = {
  /** Also names the folder that holds its uncommitted work and chat transcripts until it wakes. */
  id: string
  /** The repository on this Mac the workspace belongs to. */
  repoId: string
  displayName: string
  branch: string
  commit: string
  chats: AsleepCloudChat[]
  /** When it was last used in the other app (ISO), for the row's age. */
  lastActivityAt: string | null
}

export type AsleepCloudChat = {
  agent: 'claude'
  providerSessionId: string
  title?: string
}

/** How the uncommitted work landed in the new sandbox. */
export type AsleepCloudWakeChanges = 'none' | 'applied' | 'kept-aside'
