import type { WorkspaceStatusDefinition } from './worktree/types'

export const DEFAULT_STATUS_VISUALS: Record<string, { color: string; icon: string }> = {
  todo: { color: 'neutral', icon: 'circle' },
  'in-progress': { color: 'status-progress', icon: 'status-progress' },
  'in-review': { color: 'status-review', icon: 'status-review' },
  completed: { color: 'status-done', icon: 'status-done' },
  canceled: { color: 'zinc', icon: 'ban' }
}

export const DEFAULT_WORKSPACE_STATUSES = [
  // The Backlog keeps the `todo` id so workspaces already set to it stay put.
  { id: 'todo', label: 'Backlog', color: 'neutral', icon: 'circle' },
  {
    id: 'in-progress',
    label: 'In progress',
    color: 'status-progress',
    icon: 'status-progress'
  },
  { id: 'in-review', label: 'In review', color: 'status-review', icon: 'status-review' },
  { id: 'completed', label: 'Done', color: 'status-done', icon: 'status-done' },
  { id: 'canceled', label: 'Canceled', color: 'zinc', icon: 'ban' }
] as const satisfies readonly WorkspaceStatusDefinition[]
