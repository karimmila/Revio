import React from 'react'
import { forgeRepoTarget } from '@/lib/cloud-forge-repo'
import { Check, LoaderCircle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import type { GitHubAssignableUser } from '../../../../shared/github/pull-request-types'
import { activeLocalGitHubRepo, reviewerCandidates } from './revio-review-actions'

const BUTTON =
  'right-sidebar-header-no-drag flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-[12.5px] font-medium disabled:opacity-60'

function refreshActive(): void {
  const state = useAppStore.getState()
  if (state.activeWorktreeId) {
    void state.refreshGitHubForWorktree(state.activeWorktreeId)
  }
}

/** "Approve PR" while a review is required; it asks first, since it posts as you. */
export function RevioApproveButton({ prNumber }: { prNumber: number }): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const [busy, setBusy] = React.useState(false)
  const approve = async (): Promise<void> => {
    const repo = activeLocalGitHubRepo()
    const ok = await confirm({
      title: translate('auto.components.revioLayout.approveTitle', 'Approve #{{value0}}?', {
        value0: prNumber
      }),
      description: translate(
        'auto.components.revioLayout.approveDescription',
        'Posts an approving review on GitHub as your gh account.'
      ),
      confirmLabel: translate('auto.components.revioLayout.approvePr', 'Approve PR')
    })
    if (!ok || !repo) {
      return
    }
    const result = await window.api.gh.approvePR({
      ...forgeRepoTarget(repo),
      prNumber
    })
    if (!result.ok) {
      toast.error(result.error)
    }
    refreshActive()
  }
  return (
    <button
      type="button"
      disabled={busy}
      className={BUTTON}
      onClick={() => {
        setBusy(true)
        void approve().finally(() => setBusy(false))
      }}
    >
      {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      {translate('auto.components.revioLayout.approvePr', 'Approve PR')}
    </button>
  )
}

/** "Request review": a people picker over the repository's assignable users. */
export function RevioRequestReviewButton({ prNumber }: { prNumber: number }): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [users, setUsers] = React.useState<GitHubAssignableUser[]>([])
  const [query, setQuery] = React.useState('')
  const [picked, setPicked] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    const repo = open ? activeLocalGitHubRepo() : null
    if (!repo) {
      return
    }
    let live = true
    void window.api.gh
      .listAssignableUsers(forgeRepoTarget(repo))
      .catch((): GitHubAssignableUser[] => [])
      .then((next) => {
        if (live) {
          setUsers(next)
        }
      })
    return () => {
      live = false
    }
  }, [open])
  const send = async (): Promise<void> => {
    const repo = activeLocalGitHubRepo()
    if (!repo || picked.length === 0) {
      return
    }
    const result = await window.api.gh.requestPRReviewers({
      ...forgeRepoTarget(repo),
      prNumber,
      reviewers: picked
    })
    if (result.ok) {
      setOpen(false)
      setPicked([])
    } else {
      toast.error(result.error)
    }
    refreshActive()
  }
  const label = translate('auto.components.revioLayout.requestReview', 'Request review')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={BUTTON} aria-label={label} title={label}>
          <UserPlus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="border-b border-border p-2">
          <Input
            value={query}
            autoFocus
            className="h-7"
            placeholder={translate('auto.components.revioLayout.searchPeople', 'Search people')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="max-h-56 overflow-y-auto scrollbar-sleek p-1">
          {reviewerCandidates(users, query, []).map((user) => (
            <label
              key={user.login}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={picked.includes(user.login)}
                onChange={() =>
                  setPicked((current) =>
                    current.includes(user.login)
                      ? current.filter((login) => login !== user.login)
                      : [...current, user.login]
                  )
                }
              />
              <span className="truncate">{user.login}</span>
              {user.name ? (
                <span className="truncate text-muted-foreground">{user.name}</span>
              ) : null}
            </label>
          ))}
        </div>
        <div className="flex justify-end border-t border-border p-2">
          <button
            type="button"
            className={BUTTON}
            disabled={busy || picked.length === 0}
            onClick={() => {
              setBusy(true)
              void send().finally(() => setBusy(false))
            }}
          >
            {label}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
