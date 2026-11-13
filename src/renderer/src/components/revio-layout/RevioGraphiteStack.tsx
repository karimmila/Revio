import React from 'react'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { confirmBranchSwitch } from './revio-branch-switch-guard'
import { toast } from 'sonner'
import { ArrowRightLeft, TriangleAlert } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { GraphiteStack } from '../../../../shared/git/graphite-stack-types'
import { isRemoteWorkspace } from './revio-workspace-host'

/** The worktree's Graphite stack, re-read when `refreshKey` changes (git status moved). */
function useGraphiteStack(
  worktreeId: string,
  worktreePath: string,
  refreshKey: unknown
): GraphiteStack {
  // `gt` runs on this Mac: a workspace on another host (a cloud sandbox) has no path here, and
  // asking main about it only logged "Access denied: unknown repository or worktree path".
  const enabled = useAppStore(
    (s) => s.settings?.revioGraphiteStacks !== false && !isRemoteWorkspace(worktreeId)
  )
  const [stack, setStack] = React.useState<GraphiteStack>(null)
  React.useEffect(() => {
    if (!enabled) {
      setStack(null)
      return
    }
    let live = true
    void window.api.git
      .graphiteStack({ worktreePath })
      .catch((): GraphiteStack => null)
      .then((next) => {
        if (live) {
          setStack(next)
        }
      })
    return () => {
      live = false
    }
  }, [enabled, worktreePath, refreshKey])
  return stack
}

/**
 * The Graphite stack in Changes: each branch from the top of the stack down to trunk, a
 * warning on branches that need `gt restack`, and "Checkout this branch".
 */
export function RevioGraphiteStack({
  worktreeId,
  worktreePath,
  refreshKey
}: {
  worktreeId: string
  worktreePath: string
  refreshKey: unknown
}): React.JSX.Element | null {
  const stack = useGraphiteStack(worktreeId, worktreePath, refreshKey)
  const [pending, setPending] = React.useState<string | null>(null)
  const confirm = useConfirmationDialog()
  if (!stack || stack.branches.length < 2) {
    return null
  }
  const checkout = async (branch: string): Promise<void> => {
    if (!(await confirmBranchSwitch(confirm, worktreePath, branch))) {
      return
    }
    setPending(branch)
    try {
      await window.api.git.graphiteCheckout({ worktreePath, branch })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(null)
    }
  }
  return (
    <nav data-revio-graphite-stack="">
      {stack.branches.map((branch) => (
        <div
          key={branch.name}
          data-revio-graphite-branch=""
          data-current={branch.current ? 'true' : undefined}
          data-trunk={branch.trunk ? 'true' : undefined}
        >
          <span data-revio-stack-rail-dot="" />
          <span className="min-w-0 flex-1 truncate">
            {branch.name}
            {branch.trunk ? (
              <span className="ml-1 text-muted-foreground">
                {translate('auto.components.revioLayout.graphite.trunk', '(trunk)')}
              </span>
            ) : null}
          </span>
          {branch.needsRestack ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <TriangleAlert className="size-3 shrink-0 text-status-warning" />
              </TooltipTrigger>
              <TooltipContent>
                {translate(
                  'auto.components.revioLayout.graphite.needsRestack',
                  'This branch needs to be restacked. Use gt restack'
                )}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {!branch.current && !branch.trunk ? (
            <button
              type="button"
              disabled={pending !== null}
              aria-label={translate(
                'auto.components.revioLayout.graphite.checkout',
                'Checkout this branch'
              )}
              title={translate(
                'auto.components.revioLayout.graphite.checkout',
                'Checkout this branch'
              )}
              onClick={() => void checkout(branch.name)}
            >
              <ArrowRightLeft className="size-3" />
            </button>
          ) : null}
        </div>
      ))}
    </nav>
  )
}
