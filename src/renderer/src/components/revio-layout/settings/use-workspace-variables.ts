import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  WorkspaceVariable,
  WorkspaceVariablesScope
} from '../../../../../shared/workspace-variables/dotenv'

export function scopeKey(scope: WorkspaceVariablesScope): string {
  return scope.kind === 'global' ? 'global' : `repo:${scope.repoId}`
}

/**
 * Loads one scope's variables and saves every change straight away, as the Environment
 * page does. Saving writes the scope's .env file in Orca's data folder.
 */
export function useWorkspaceVariables(scope: WorkspaceVariablesScope): {
  variables: WorkspaceVariable[] | null
  save: (next: WorkspaceVariable[]) => void
  reload: () => void
} {
  const key = scopeKey(scope)
  const [state, setState] = React.useState<{ key: string; variables: WorkspaceVariable[] } | null>(
    null
  )
  const scopeRef = React.useRef(scope)
  scopeRef.current = scope
  const reload = React.useCallback(() => {
    const api = window.api.workspaceVariables
    if (!api) {
      return
    }
    void api
      .read(scopeRef.current)
      .then((variables) => setState({ key, variables }))
      .catch(() => setState({ key, variables: [] }))
  }, [key])
  React.useEffect(reload, [reload])
  const save = React.useCallback(
    (next: WorkspaceVariable[]) => {
      setState({ key, variables: next })
      void window.api.workspaceVariables?.write(scopeRef.current, next).catch((error: unknown) => {
        toast.error(
          translate('auto.components.revioLayout.settings.envSaveFailed', 'Could not save'),
          { description: error instanceof Error ? error.message : String(error) }
        )
        reload()
      })
    },
    [key, reload]
  )
  return { variables: state?.key === key ? state.variables : null, save, reload }
}

/** Adds or replaces variables by name, keeping each existing one's cloud choice. */
export function mergeVariables(
  current: readonly WorkspaceVariable[],
  incoming: Record<string, string>
): WorkspaceVariable[] {
  const next = current.map((variable) =>
    variable.key in incoming ? { ...variable, value: incoming[variable.key] ?? '' } : variable
  )
  for (const [key, value] of Object.entries(incoming)) {
    if (!current.some((variable) => variable.key === key)) {
      next.push({ key, value, sendToCloud: false })
    }
  }
  return next
}
