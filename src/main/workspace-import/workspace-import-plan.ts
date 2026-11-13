import type {
  ImportSourceChat,
  ImportSourceWorkspace,
  WorkspaceImportOptions,
  WorkspaceImportSummary
} from '../../shared/workspace-import-types'
import type { WorkspaceImportLedger } from './workspace-import-ledger'

export type PlannedWorkspace = {
  source: ImportSourceWorkspace
  /** Set when an earlier run already made this workspace. */
  existingWorktreeId: string | null
  chats: ImportSourceChat[]
}

function counts(workspaces: readonly ImportSourceWorkspace[]): {
  workspaces: number
  chats: number
} {
  return {
    workspaces: workspaces.length,
    chats: workspaces.reduce((total, workspace) => total + workspace.chats.length, 0)
  }
}

function pendingOnly(
  workspaces: readonly ImportSourceWorkspace[],
  ledger: WorkspaceImportLedger
): { workspaces: number; chats: number } {
  let workspaceCount = 0
  let chatCount = 0
  for (const workspace of workspaces) {
    workspaceCount += ledger.workspaces[workspace.sourceId] ? 0 : 1
    chatCount += workspace.chats.filter((chat) => !ledger.chats[chat.sourceId]).length
  }
  return { workspaces: workspaceCount, chats: chatCount }
}

export function summarizeImportSource(
  workspaces: readonly ImportSourceWorkspace[],
  ledger: WorkspaceImportLedger
): WorkspaceImportSummary {
  const active = workspaces.filter((workspace) => !workspace.archived)
  const archived = workspaces.filter((workspace) => workspace.archived)
  return {
    repoNames: [...new Set(workspaces.map((workspace) => workspace.repoName))].sort(),
    active: counts(active),
    archived: counts(archived),
    pending: { active: pendingOnly(active, ledger), archived: pendingOnly(archived, ledger) },
    hasMirroredChanges: active.some((workspace) => workspace.mirrorPath !== null)
  }
}

/** Oldest first, so the most recently used workspace is made last and sits on top. */
export function planWorkspaceImport(
  workspaces: readonly ImportSourceWorkspace[],
  ledger: WorkspaceImportLedger,
  options: Pick<WorkspaceImportOptions, 'includeArchived'>
): PlannedWorkspace[] {
  return workspaces
    .filter((workspace) => options.includeArchived || !workspace.archived)
    .map((source) => ({
      source,
      existingWorktreeId: ledger.workspaces[source.sourceId] ?? null,
      chats: source.chats.filter((chat) => !ledger.chats[chat.sourceId])
    }))
    .filter((planned) => planned.existingWorktreeId === null || planned.chats.length > 0)
    .sort((a, b) => (a.source.lastActivityAt ?? '').localeCompare(b.source.lastActivityAt ?? ''))
}

/** The chat used last across the plan, whose workspace opens when the import ends. */
export function mostRecentSourceWorkspace(
  workspaces: readonly ImportSourceWorkspace[]
): ImportSourceWorkspace | null {
  let best: ImportSourceWorkspace | null = null
  for (const workspace of workspaces) {
    if (!best || (workspace.lastActivityAt ?? '') > (best.lastActivityAt ?? '')) {
      best = workspace
    }
  }
  return best
}
