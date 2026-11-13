import React from 'react'
import {
  ChevronDown,
  Focus,
  Globe,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Square
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { isActionHidden } from '../../../../shared/actions/hidden-actions'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ActionRunMode } from '../../../../shared/actions/repo-actions'
import {
  lastRunActionId,
  rememberRunAction,
  repoActionExitCode,
  resolveActionContext,
  runningRepoActionTab,
  stopRepoAction,
  useRepoActionRuns,
  type ActionContext
} from '@/lib/repo-action-run'
import { runnableActions } from '../../../../shared/actions/repo-action-runnables'
import { startRunnable } from './revio-action-start'
import { openRevioSettingsPage } from './settings/revio-settings-view'
import { ActionIcon } from './action-icon'
import { spotlightTabId, toggleSpotlight } from './revio-spotlight'
import { usePreviewUrls, type Runnable } from './revio-run-helpers'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { openPreviewUrl } from './revio-open-localhost'
import { launchRevioAgentChat } from './launch-revio-chat'
import { ADD_ACTION_PROMPT } from './revio-prompts'
import { rerunRevioSetup, stopRevioSetup } from './revio-setup-rerun'
import { RevioSetupFixItem } from './RevioSetupFixItem'

type WorkspaceActions = {
  context: ActionContext | null
  runnables: Runnable[]
  runMode: ActionRunMode
}

function useWorkspaceActions(): WorkspaceActions {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const hiddenActions = useAppStore((s) => s.settings?.revioHiddenActions)
  const [state, setState] = React.useState<WorkspaceActions>({
    context: null,
    runnables: [],
    runMode: 'concurrent'
  })
  const [revision, setRevision] = React.useState(0)
  React.useEffect(
    () => window.api.repoActions?.onChanged(() => setRevision((current) => current + 1)),
    []
  )
  React.useEffect(() => {
    let live = true
    if (!worktreeId) {
      setState({ context: null, runnables: [], runMode: 'concurrent' })
      return
    }
    void resolveActionContext(worktreeId).then(async (context) => {
      const listed = context ? await window.api.repoActions?.list(context.sourceRepoId) : null
      if (live) {
        setState({
          context,
          runnables:
            context && listed
              ? runnableActions(
                  context,
                  listed.actions.filter(
                    (action) => !isActionHidden(hiddenActions, context.sourceRepoId, action.id)
                  )
                )
              : [],
          runMode: listed?.runMode ?? 'concurrent'
        })
      }
    })
    return () => {
      live = false
    }
  }, [hiddenActions, revision, worktreeId])
  return state
}

const GROUP_LABEL = {
  cloud: () => translate('auto.components.revioLayout.cloudLocation', 'Cloud'),
  mirror: () => translate('auto.components.revioLayout.localMirror', 'Local mirror'),
  local: () => translate('auto.components.revioLayout.localGroup', 'This Mac')
}

/**
 * The Run button in the terminal area: it runs the workspace's last action (⌘R) and its
 * menu lists every action this workspace can run, grouped by where it runs, plus "Add action".
 */
export function RevioRunButton(): React.JSX.Element | null {
  const { context, runnables, runMode } = useWorkspaceActions()
  const previews = usePreviewUrls(context && context.kind !== 'cloud' ? context.worktreeId : null)
  const spotlight = useAppStore(
    (s) =>
      context?.kind === 'local' &&
      (s.settings?.revioSpotlightRepos ?? []).includes(context.sourceRepoId)
  )
  // Re-render when the Spotlight tab opens or closes.
  useAppStore((s) => s.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]?.length)
  const [lastId, setLastId] = React.useState<string | null>(null)
  React.useEffect(() => {
    setLastId(context ? lastRunActionId(context.sourceRepoId) : null)
  }, [context])
  const primary =
    runnables.find((entry) => `${entry.group}:${entry.action.id}` === lastId) ?? runnables[0]
  // Re-render when tabs close, so the button flips back from Stop.
  useAppStore((s) => (primary ? s.tabsByWorktree[primary.worktreeId]?.length : 0))
  // And when the action's script exits while its tab stays open.
  useRepoActionRuns()
  const primaryRunning = primary
    ? runningRepoActionTab(primary.action.id, primary.worktreeId) !== null
    : false
  const primaryExit = primary ? repoActionExitCode(primary.action.id, primary.worktreeId) : null
  const run = React.useCallback(
    async (entry: Runnable) => {
      if (!context) {
        return
      }
      // ⌘R starts the action, and stops it while it runs.
      if (stopRepoAction(entry.action.id, entry.worktreeId)) {
        return
      }
      const started = await startRunnable(context, entry, runMode, spotlight)
      if (started === 'declined') {
        return
      }
      if (!started) {
        toast.error(
          translate('auto.components.revioLayout.actionFailed', 'Could not start {{value0}}', {
            value0: entry.action.name
          })
        )
        return
      }
      const key = `${entry.group}:${entry.action.id}`
      rememberRunAction(context.sourceRepoId, key)
      setLastId(key)
      if (entry.group === 'mirror' && entry.worktreeId !== context.worktreeId) {
        toast.success(
          translate(
            'auto.components.revioLayout.actionInMirror',
            '{{value0}} is running in the local mirror',
            { value0: entry.action.name }
          )
        )
      }
    },
    [context, runMode, spotlight]
  )
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !primary ||
        !event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== 'r' ||
        useAppStore.getState().activeTabType === 'browser'
      ) {
        return
      }
      event.preventDefault()
      void run(primary)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [primary, run])
  if (!context) {
    return null
  }
  const groups = (['cloud', 'mirror', 'local'] as const).filter((group) =>
    runnables.some((entry) => entry.group === group)
  )
  const configure = (): void => {
    useAppStore.getState().openSettingsPage()
    openRevioSettingsPage(`repo:${context.sourceRepoId}`)
  }
  return (
    <div data-revio-run-button="" className="ml-auto flex items-center gap-1">
      {spotlight ? (
        <button
          type="button"
          onClick={() => toggleSpotlight(context.worktreeId)}
          data-revio-spotlight={spotlightTabId(context.worktreeId) ? 'on' : 'off'}
          className="flex h-6 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] text-foreground hover:bg-accent"
        >
          <Focus className="size-3" />
          {spotlightTabId(context.worktreeId)
            ? translate('auto.components.revioLayout.stopSpotlight', 'Stop Spotlight')
            : translate('auto.components.revioLayout.spotlight', 'Spotlight')}
        </button>
      ) : null}
      {primaryExit !== null ? (
        <span
          data-revio-run-exit={primaryExit === 0 ? 'ok' : 'failed'}
          className={
            primaryExit === 0
              ? 'text-[11px] text-muted-foreground'
              : 'text-[11px] text-[var(--revio-row-failing)]'
          }
        >
          {primaryExit === 0
            ? translate('auto.components.revioLayout.runExitedOk', '✓ exited 0')
            : translate('auto.components.revioLayout.runExitedFailed', '✗ exited {{value0}}', {
                value0: primaryExit
              })}
        </span>
      ) : null}
      {primary ? (
        <button
          type="button"
          onClick={() => void run(primary)}
          className="flex h-6 items-center gap-1.5 rounded-l-md border border-border px-2 text-[12px] text-foreground hover:bg-accent"
        >
          {primaryRunning ? (
            <Square className="size-3 fill-current" />
          ) : (
            <ActionIcon icon={primary.action.icon} className="size-3" />
          )}
          {primaryRunning
            ? translate('auto.components.revioLayout.stopAction', 'Stop {{value0}}', {
                value0: primary.action.name
              })
            : primary.action.name}
          <span className="text-muted-foreground">
            {translate('auto.components.revioLayout.runShortcut', '⌘R')}
          </span>
        </button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={translate('auto.components.revioLayout.actions', 'Actions')}
            className={
              primary
                ? 'flex h-6 items-center rounded-r-md border border-l-0 border-border px-1 text-muted-foreground hover:bg-accent'
                : 'flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[12px] text-muted-foreground hover:bg-accent'
            }
          >
            {primary ? null : <Play className="size-3" />}
            {primary ? null : translate('auto.components.revioLayout.run', 'Run')}
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {groups.map((group) => (
            <React.Fragment key={group}>
              <DropdownMenuLabel>{GROUP_LABEL[group]()}</DropdownMenuLabel>
              {runnables
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <DropdownMenuItem
                    key={`${group}:${entry.action.id}`}
                    onSelect={() => void run(entry)}
                  >
                    <ActionIcon icon={entry.action.icon} className="size-3" />
                    {entry.action.name}
                    {entry === primary ? (
                      <DropdownMenuShortcut>
                        {translate('auto.components.revioLayout.runShortcut', '⌘R')}
                      </DropdownMenuShortcut>
                    ) : null}
                  </DropdownMenuItem>
                ))}
            </React.Fragment>
          ))}
          {groups.length > 0 ? <DropdownMenuSeparator /> : null}
          {previews.map((url, index) => (
            <DropdownMenuItem
              key={url}
              onSelect={() => context && openPreviewUrl(context.worktreeId, url)}
            >
              <Globe className="size-3.5" />
              <span className="truncate">{url}</span>
              {index === 0 ? (
                <DropdownMenuShortcut>
                  {translate('auto.components.revioLayout.openLocalhostShortcut', '⌘⇧B')}
                </DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          ))}
          {previews.length > 0 ? <DropdownMenuSeparator /> : null}
          {context.kind !== 'mirror' ? <RevioSetupFixItem worktreeId={context.worktreeId} /> : null}
          {context.kind !== 'mirror' ? (
            <DropdownMenuItem onSelect={() => void rerunRevioSetup(context.worktreeId)}>
              <RotateCcw className="size-3.5" />
              {translate('auto.components.revioLayout.rerunSetup', 'Rerun setup')}
            </DropdownMenuItem>
          ) : null}
          {context.kind !== 'mirror' ? (
            <DropdownMenuItem onSelect={() => void stopRevioSetup(context.worktreeId)}>
              <Square className="size-3.5" />
              {translate('auto.components.revioLayout.stopSetup', 'Stop setup')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Plus className="size-3.5" />
              {translate('auto.components.revioLayout.addAction', 'Add action')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                disabled={context.kind === 'mirror'}
                onSelect={() =>
                  launchRevioAgentChat(context.worktreeId, { prompt: ADD_ACTION_PROMPT })
                }
              >
                <Sparkles className="size-3.5" />
                {translate('auto.components.revioLayout.askAgent', 'Ask agent')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={configure}>
                <Pencil className="size-3.5" />
                {translate('auto.components.revioLayout.addManually', 'Add manually')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={configure}>
            <Settings2 className="size-3.5" />
            {translate('auto.components.revioLayout.configureActions', 'Configure')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
