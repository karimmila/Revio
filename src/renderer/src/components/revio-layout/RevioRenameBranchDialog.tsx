import React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type { Worktree } from '../../../../shared/worktree/types'

/** Mounted per opening, so each opening starts from the current branch name. */
function RenameBranchForm({
  worktree,
  connectionId,
  onDone
}: {
  worktree: Worktree
  connectionId: string | null
  onDone: () => void
}): React.JSX.Element {
  const currentBranch = worktree.branch.replace(/^refs\/heads\//, '')
  const [name, setName] = React.useState(currentBranch)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const trimmed = name.trim()
  const unchanged = trimmed === currentBranch

  const submit = async (): Promise<void> => {
    if (!trimmed || unchanged || pending) {
      return
    }
    setPending(true)
    setError(null)
    try {
      const renamed = await window.api.git.renameBranch({
        worktreePath: worktree.path,
        newBranch: trimmed,
        connectionId: connectionId ?? undefined
      })
      await useAppStore.getState().fetchWorktrees(worktree.repoId)
      toast.success(
        translate('auto.components.revioLayout.branchRenamed', 'Branch renamed to {{value0}}', {
          value0: renamed
        })
      )
      onDone()
    } catch (caught) {
      setError(
        extractIpcErrorMessage(
          caught,
          translate(
            'auto.components.revioLayout.renameBranchFailed',
            'Could not rename the branch.'
          )
        )
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-2"
    >
      <Input
        autoFocus
        variant="code"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        spellCheck={false}
        aria-label={translate('auto.components.revioLayout.branchName', 'Branch name')}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {translate('auto.components.revioLayout.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={!trimmed || unchanged || pending}>
          {translate('auto.components.revioLayout.rename', 'Rename')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Runs `git branch -m` in the workspace; the remote branch and any pull request keep the old name. */
export function RevioRenameBranchDialog({
  worktree,
  connectionId,
  open,
  onOpenChange
}: {
  worktree: Worktree
  connectionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.revioLayout.renameBranchTitle', 'Rename branch')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.revioLayout.renameBranchDescription',
              'Renames the local branch. A pushed branch and its pull request keep the old name.'
            )}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <RenameBranchForm
            worktree={worktree}
            connectionId={connectionId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
