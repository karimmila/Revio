import type { ClaudeOutputStyle, CodexPersonality } from './revio-agent-style'
import type { RevioLoadout } from './revio-loadouts'
import type { RevioPromptSnippet } from './revio-prompt-snippets'
import type { RevioPrOpenTarget } from './revio-pr-open-target'

// Settings the Orca fork's workspace layout adds; kept apart so GlobalSettings stays under its size
// cap.

export type RevioPrompts = {
  review?: string
  createPr?: string
  fixErrors?: string
  resolveConflicts?: string
}

/** A user's own sidebar section (custom sections). */
export type RevioSidebarSection = { id: string; name: string }

export type RevioLayoutSettings = {
  /** Workspace layout: text tabs on the right, Create/Search sidebar head, row line totals. */
  revioLayout?: boolean
  /** Workspace layout: ⌘Enter sends a chat message and Enter makes a new line. */
  revioSendWithModEnter?: boolean
  /** Workspace layout: false keeps long pasted text inline instead of turning it into an attachment. */
  revioPasteLongTextAsAttachment?: boolean
  /** Workspace layout: new Claude and Codex chats start in plan mode. */
  revioDefaultPlanMode?: boolean
  /** Workspace layout: the composer's context ring shows at any usage, not only above 70%. */
  revioAlwaysShowContextUsage?: boolean
  /** Strips a leading "You're absolutely right!" from assistant replies. */
  revioStripAbsolutelyRight?: boolean
  /** Workspace layout: sidebar rows color their line totals even when not selected. */
  revioColoredSidebarDiffs?: boolean
  /** Workspace layout: how rendered markdown looks; 'tufte' is a book-like serif style. */
  revioMarkdownStyle?: 'default' | 'tufte'
  /** Claude Code signs in with a stored API key or a custom gateway token instead of an account. */
  revioClaudeAuth?: 'apiKey' | 'custom'
  /** Codex signs in with a stored OpenAI API key instead of a ChatGPT account. */
  revioCodexAuth?: 'apiKey'
  /** Claude chats start with Claude in Chrome (`--chrome`). */
  revioClaudeChrome?: boolean
  /** Workspace layout: CPU and memory in the workspace sidebar's footer. */
  revioSidebarResourceUsage?: boolean
  /** Workspace layout: a browser-style bar of visited workspaces after a fixed Home tab. */
  revioWorkspaceTabs?: boolean
  /** Workspace layout: the window material shows through the workspace sidebar only. */
  revioSidebarTransparency?: boolean
  /** The window material Sidebar transparency replaced with Blur; restored when it is turned off. */
  revioSidebarTransparencyPriorMaterial?: 'off' | 'translucent' | 'blur'
  /** Workspace layout: softer colors in the dark theme. */
  revioLowContrastDark?: boolean
  /** Workspace layout: diff and git colors that stay apart for color vision differences. */
  revioAccessibleColors?: boolean
  /** Workspace layout: chat tool calls start expanded. */
  revioExpandToolCalls?: boolean
  /** Workspace layout: failing or pending optional (non-required) checks keep a PR from Ready to merge. */
  revioOptionalChecksBlocking?: boolean
  /** Workspace layout: an Automerge button in the PR bar while checks are pending. */
  revioAutoMerge?: boolean
  /** Workspace layout: merging a workspace's PR from the PR bar archives the workspace. */
  revioArchiveOnMerge?: boolean
  /** Workspace layout: an automatic branch rename also renames the workspace (on by default). */
  revioRenameWorkspaceWithBranch?: boolean
  /** Workspace layout: actions hidden from the Run menu ("Hide action"), as `repoId\nactionId`. */
  revioHiddenActions?: string[]
  /** Workspace layout: archiving a workspace also deletes its local branch. */
  revioDeleteBranchOnArchive?: boolean
  /** Workspace layout: where a pull request link opens. */
  revioOpenPullRequestsIn?: RevioPrOpenTarget
  /** Workspace layout (experimental): ⌘⇧T opens a terminal tab in the center pane. */
  revioBigTerminal?: boolean
  /** Workspace layout (experimental "New workspace page"): Create opens as a full page in the main area, not a modal. */
  revioNewWorkspacePage?: boolean
  /** Workspace layout: the command a new big terminal tab runs ("New tab preset"); empty runs none. */
  revioBigTerminalPreset?: string
  /** Workspace layout: repository ids whose Run uses Spotlight (workspace changes synced into the root). */
  revioSpotlightRepos?: string[]
  /** Workspace layout: per repository id, env files (relative to the workspace) loaded into setup, archive and Run scripts. */
  revioEnvFiles?: Record<string, string[]>
  /** Workspace layout: per repository id, "Files to copy" patterns for new workspaces; absent copies `.env*`. A `.worktreeinclude` wins. */
  revioFileIncludeGlobs?: Record<string, string[]>
  /** Workspace layout (experimental): preview URLs and ⌘⇧B open in an Orca browser tab even when links open outside Orca. */
  revioInAppBrowserPreview?: boolean
  /** Workspace layout (experimental): start the repository's default action when a new workspace's setup succeeds. */
  revioAutoRunAfterSetup?: boolean
  /** Advanced: Help > Open debug tools works in packaged builds. Off by default; dev builds always allow it. */
  revioDebugTools?: boolean
  /** Advanced: Quit leaves the terminal service and its shells running for the next launch. Off by default: Quit stops them. */
  revioKeepTerminalsAfterQuit?: boolean
  /** Workspace layout: per repository id, the remote push, pull/fetch and PR lookup use; absent is Automatic. */
  revioRepoRemotes?: Record<string, string>
  /** Workspace layout: name and email cloud workspaces commit with; blank fields use the Mac's git config. */
  revioGitIdentity?: { name?: string; email?: string }
  /** Workspace layout: Create PR adds the workspace's Orca link to the PR description. */
  revioPrWorkspaceLink?: boolean
  /** Workspace layout: new workspaces set `push.autoSetupRemote`, so a plain `git push` sets the upstream. */
  revioSetUpstreamOnPush?: boolean
  /** Workspace layout: chats are told they may build a feature as a stack of pull requests with `gh stack`. */
  revioStackedPullRequests?: boolean
  /** Workspace layout: install a downloaded update once no agent works and the Mac has been idle. */
  revioRestartOnUpdate?: boolean
  /** Workspace layout: the model Review chats use, as `agent:modelId`; unset uses the default agent and model. */
  revioReviewModel?: string
  /** Workspace layout: "General preferences", custom instructions sent to every new chat. */
  revioGeneralPreferences?: string
  /** Workspace layout: per-repository "General preferences", keyed by repo id; one replaces the global text. */
  revioRepoGeneralPreferences?: Record<string, string>
  /** Workspace layout: detect Graphite stacks with `gt state` and show them in Changes; false never runs gt. */
  revioGraphiteStacks?: boolean
  /** Workspace layout: per-repository overrides of the prompts below, keyed by repo id. */
  revioRepoPrompts?: Record<string, RevioPrompts>
  /** Workspace layout (experimental): local workspaces without a PR show their agent state as a dot matrix. */
  revioStatusMatrix?: boolean
  /** Workspace layout: the user's sidebar sections, in order. */
  revioSidebarSections?: RevioSidebarSection[]
  /** Workspace layout: workspace id → the section it was moved to. */
  revioWorkspaceSections?: Record<string, string>
  /** Workspace layout: the prompts behind Review, Create PR, Fix errors and Resolve conflicts. */
  revioPrompts?: RevioPrompts
  /** Workspace layout: saved prompts a chat inserts with ⌘; ("Insert snippet"). */
  revioPromptSnippets?: RevioPromptSnippet[]
  /** Workspace layout: up to five saved agent + model + effort sets, picked with ⌘⌃1…5. */
  revioLoadouts?: RevioLoadout[]
  /** Workspace layout: the personality new Codex chats start with (Codex's `personality` config). */
  revioCodexPersonality?: CodexPersonality
  /** Workspace layout: the Claude Code output style new Claude chats start with. */
  revioClaudeOutputStyle?: ClaudeOutputStyle
  /** Workspace layout: `/add-dir` folders by workspace path, given to that workspace's Claude chats. */
  revioLinkedDirectories?: Record<string, string[]>
  /** Workspace layout: up to 10 chat and terminal tabs per workspace instead of 5 (Tab Freak Mode). */
  revioTabFreakMode?: boolean
  /** Workspace layout: Split tabs; while on (Orca's split panes) the tab cap does not apply. */
  revioSplitTabs?: boolean
  /** Workspace layout: the sidebar lists and creates workspaces on this Mac or in the cloud. */
  revioLocation?: 'local' | 'cloud'
  /** Workspace layout: minutes before an idle cloud workspace's sandbox stops; 0 never stops it. */
  revioCloudIdleMinutes?: number
  /** "SSH private key path": the person's own key for new cloud workspaces; empty
   * makes a key per workspace. Only `<path>.pub` is sent to the sandbox. */
  revioCloudSshKeyPath?: string
}
