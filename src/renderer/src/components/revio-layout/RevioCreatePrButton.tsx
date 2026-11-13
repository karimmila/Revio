import { revioPromptsForWorktree } from './revio-prompts-for-worktree'
import React from 'react'
import { ChevronDown, GitPullRequestCreateArrow, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { githubSlugOfRepo } from '@/lib/cloud-create-guard'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { launchRevioAgentChat } from './launch-revio-chat'
import { createPrPrompt, manualPrBody } from './revio-prompts'
import { buildRevioLink } from '../../../../shared/revio-link'
import { openRevioPullRequest } from './open-revio-pull-request'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { RevioCreatePrNotice } from './RevioCreatePrNotice'
import {
  createPrBlockMessage,
  readCreatePrBlock,
  type CreatePrBlock
} from './revio-create-pr-precheck'
import { createPrChatRunning, showCreatePrChat, startCreatePrChat } from './revio-create-pr-chat'

export type CreatePrMode = 'agent' | 'draft' | 'manual'

/** GitHub's compare page for the workspace's branch against its target branch. */
function compareUrl(worktreeId: string): string | null {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  const slug = repo ? githubSlugOfRepo(repo) : null
  const branch = worktree?.branch.replace(/^refs\/heads\//, '')
  const base = state.gitBranchCompareSummaryByWorktree[worktreeId]?.baseRef?.replace(
    /^(refs\/remotes\/)?origin\//,
    ''
  )
  if (!slug || !branch || !base) {
    return null
  }
  const ref = (name: string): string => name.split('/').map(encodeURIComponent).join('/')
  const link = workspaceLinkFor(worktreeId)
  const body = link ? `&body=${encodeURIComponent(manualPrBody(link))}` : ''
  return `https://github.com/${slug.owner}/${slug.name}/compare/${ref(base)}...${ref(branch)}?expand=1${body}`
}

function workspaceLinkFor(worktreeId: string): string | null {
  return useAppStore.getState().settings?.revioPrWorkspaceLink === true
    ? buildRevioLink({ worktreeId })
    : null
}

/**
 * The Create PR: the agent writes and opens the PR with the Create PR preferences; a
 * draft PR the same way; or GitHub's own form, filled in by hand.
 */
export function createRevioPullRequest(worktreeId: string, mode: CreatePrMode): void {
  if (mode === 'manual') {
    const url = compareUrl(worktreeId)
    if (url) {
      openRevioPullRequest(url)
    }
    return
  }
  const prompt = createPrPrompt({
    prompts: revioPromptsForWorktree(worktreeId),
    draft: mode === 'draft',
    workspaceLink: workspaceLinkFor(worktreeId)
  })
  startCreatePrChat(worktreeId, () => launchRevioAgentChat(worktreeId, { prompt }))
}

/**
 * Create PR as the button and its key ask for it: nothing starts while a sign-in, a GitHub remote,
 * the app's install or any change is missing (the reason comes back instead), and a workspace that
 * already has a Create PR chat shows that chat instead of opening another.
 */
export async function requestRevioPullRequest(
  worktreeId: string,
  mode: CreatePrMode
): Promise<CreatePrBlock | null> {
  const block = await readCreatePrBlock(worktreeId, mode !== 'manual')
  if (block) {
    return block
  }
  if (mode === 'manual' || !showCreatePrChat(worktreeId)) {
    createRevioPullRequest(worktreeId, mode)
  }
  return null
}

/** The ⌘⇧P route has no button to hang the reason on, so it says it in a toast. */
export function requestRevioPullRequestFromKey(worktreeId: string): void {
  void requestRevioPullRequest(worktreeId, 'agent').then((block) => {
    if (block) {
      toast.message(createPrBlockMessage(block))
    }
  })
}

const RUNNING_RECHECK_MS = 21_000

export function RevioCreatePrButton({
  worktreeId
}: {
  worktreeId: string | null
}): React.JSX.Element {
  // Kept with its workspace, so another workspace never shows this one's reason.
  const [blocked, setBlocked] = React.useState<{
    worktreeId: string
    block: CreatePrBlock
  } | null>(null)
  const block = blocked?.worktreeId === worktreeId ? blocked.block : null
  const setBlock = (next: CreatePrBlock | null): void =>
    setBlocked(next && worktreeId ? { worktreeId, block: next } : null)
  const [checking, setChecking] = React.useState(false)
  // The "just asked" window of a starting chat ends on the clock, not on a store change.
  const [, recheck] = React.useReducer((count: number) => count + 1, 0)
  const running = useAppStore((s) =>
    worktreeId ? createPrChatRunning(s, worktreeId, Date.now()) : false
  )
  const request = (mode: CreatePrMode): void => {
    if (!worktreeId || checking) {
      return
    }
    setChecking(true)
    void requestRevioPullRequest(worktreeId, mode)
      .then((next) => {
        setBlock(next)
        window.setTimeout(recheck, RUNNING_RECHECK_MS)
      })
      .finally(() => setChecking(false))
  }
  const busy = running || checking
  const createLabel = translate('auto.components.revioLayout.createPr', 'Create PR')
  return (
    <Popover open={block !== null} onOpenChange={(open) => !open && setBlock(null)}>
      <PopoverAnchor asChild>
        <div className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center overflow-hidden rounded-md border border-border text-[12.5px] text-muted-foreground">
          <button
            type="button"
            onClick={() => request('agent')}
            disabled={!worktreeId || busy}
            data-create-pr-running={running ? '' : undefined}
            aria-busy={checking || undefined}
            title={
              running
                ? translate(
                    'auto.components.revioLayout.createPrRunning',
                    'The Create PR chat is working'
                  )
                : checking
                  ? translate('auto.components.revioLayout.createPrChecking', 'Checking…')
                  : undefined
            }
            className="flex h-full items-center gap-1.5 px-2 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <GitPullRequestCreateArrow className="size-3.5" />
            )}
            {createLabel}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!worktreeId}
                aria-label={translate(
                  'auto.components.revioLayout.createPrOptions',
                  'More ways to create a PR'
                )}
                className="flex h-full items-center border-l border-border px-1 transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={busy} onSelect={() => request('agent')}>
                {createLabel}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => request('draft')}>
                {translate('auto.components.revioLayout.createDraftPr', 'Create draft PR')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => request('manual')}>
                {translate('auto.components.revioLayout.createPrManually', 'Create PR manually')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" sideOffset={6} className="w-72">
        {block ? <RevioCreatePrNotice block={block} onDone={() => setBlock(null)} /> : null}
      </PopoverContent>
    </Popover>
  )
}
