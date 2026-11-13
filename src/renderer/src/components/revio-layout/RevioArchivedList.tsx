import React from 'react'
import { archivedDeleteSubject } from './revio-archived-delete-subject'
import { ArchiveRestore, Ellipsis, GitBranch, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTime } from '@/i18n/relative-time-format'
import {
  deleteArchivedWorkspace,
  onRevioArchiveChanged,
  unarchiveRevioWorkspace
} from '@/lib/revio-archive'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ArchivedWorkspace } from '../../../../shared/revio-archive-types'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import {
  restoreScenarioText,
  type ConfirmRestoreToNewBranch,
  type RestoreScenario
} from '@/lib/revio-archive-restore'

function useArchivedWorkspaces(): ArchivedWorkspace[] | null {
  const [records, setRecords] = React.useState<ArchivedWorkspace[] | null>(null)
  React.useEffect(() => {
    let live = true
    const load = (): void => {
      void window.api.revioArchive
        ?.list()
        .then((next) => live && setRecords(next))
        .catch(() => live && setRecords([]))
    }
    load()
    const stop = onRevioArchiveChanged(load)
    return () => {
      live = false
      stop()
    }
  }, [])
  return records
}

/** Home's "Only archived": the archived workspaces of this location, newest first, to unarchive. */
export function RevioArchivedList({
  cloud,
  query,
  showRepo
}: {
  cloud: boolean
  query: string
  showRepo: boolean
}): React.JSX.Element {
  const records = useArchivedWorkspaces()
  const repos = useAppStore((s) => s.repos)
  const [now] = React.useState(() => Date.now())
  const [busy, setBusy] = React.useState<string | null>(null)
  // Records being deleted leave the list as soon as the person confirms, not when main is done.
  const [deleting, setDeleting] = React.useState<ReadonlySet<string>>(() => new Set())
  // Delete asks only once its menu has closed, so the menu's focus return never races the prompt.
  const deleteAfterMenuCloses = React.useRef<ArchivedWorkspace | null>(null)
  const confirm = useConfirmationDialog()
  const confirmNewBranch =
    (record: ArchivedWorkspace): ConfirmRestoreToNewBranch =>
    (scenario: RestoreScenario) => {
      const { title, body } = restoreScenarioText(scenario, record.branch ?? '')
      return confirm({
        title,
        description: body,
        confirmLabel: translate(
          'auto.components.revioLayout.restoreConfirm',
          'Restore to new branch'
        ),
        cancelLabel: translate('auto.components.revioLayout.restoreCancel', 'Cancel')
      })
    }
  const confirmDelete = (record: ArchivedWorkspace): Promise<boolean> =>
    confirm({
      title: translate('auto.components.revioLayout.deleteArchivedTitle', 'Delete {{value0}}?', {
        value0: archivedDeleteSubject(record, records ?? [])
      }),
      description: record.cloud
        ? translate(
            'auto.components.revioLayout.deleteArchivedBody',
            'It leaves the archive, and its restore point and the uncommitted work it holds are gone for good. Pushed commits stay on GitHub.'
          )
        : translate(
            'auto.components.revioLayout.deleteArchivedBodyLocal',
            'It leaves the archive, and its restore point and the uncommitted work it holds are gone for good. The branch stays in your repository.'
          ),
      confirmLabel: translate('auto.components.revioLayout.deleteArchivedConfirm', 'Delete'),
      confirmVariant: 'destructive',
      cancelLabel: translate('auto.components.revioLayout.restoreCancel', 'Cancel')
    })
  const deleteRecord = (record: ArchivedWorkspace): void => {
    void confirmDelete(record).then((confirmed) => {
      if (!confirmed) {
        return
      }
      setDeleting((current) => new Set(current).add(record.id))
      void deleteArchivedWorkspace(record).then((deleted) => {
        if (!deleted) {
          setDeleting((current) => {
            const next = new Set(current)
            next.delete(record.id)
            return next
          })
        }
      })
    })
  }
  const needle = query.trim().toLowerCase()
  const rows = (records ?? []).filter(
    (record) =>
      record.cloud === cloud &&
      !deleting.has(record.id) &&
      repos.some((repo) => repo.id === record.repoId) &&
      (!needle ||
        record.displayName.toLowerCase().includes(needle) ||
        (record.branch ?? '').toLowerCase().includes(needle))
  )
  if (records !== null && rows.length === 0) {
    return (
      <p className="px-4 py-6 text-[12px] text-muted-foreground">
        {translate('auto.components.revioLayout.noArchived', 'No archived workspaces.')}
      </p>
    )
  }
  return (
    <>
      {rows.map((record) => {
        const repoName = repos.find((repo) => repo.id === record.repoId)?.displayName ?? ''
        // A cloud workspace comes back only when it was archived asleep, with what it needs.
        const canRestore = !!record.branch && (!record.cloud || !!record.cloudRestore)
        return (
          <div
            key={record.id}
            data-revio-archived-row=""
            className="group flex h-10 items-center gap-3 border-b border-border pr-2 pl-4 text-[12px] text-foreground/75"
          >
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{record.displayName}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatUiRelativeTime(record.archivedAt - now)}
            </span>
            {showRepo ? (
              <span className="w-40 shrink-0 truncate text-muted-foreground">{repoName}</span>
            ) : null}
            <button
              type="button"
              disabled={!canRestore || busy === record.id}
              title={
                canRestore
                  ? undefined
                  : translate(
                      'auto.components.revioLayout.unarchiveUnavailable',
                      'Only a local workspace on a branch can be unarchived.'
                    )
              }
              onClick={() => {
                setBusy(record.id)
                void unarchiveRevioWorkspace(record, confirmNewBranch(record)).finally(() =>
                  setBusy(null)
                )
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ArchiveRestore className="size-3.5" />
              {translate('auto.components.revioLayout.unarchive', 'Unarchive')}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy === record.id}
                  aria-label={translate(
                    'auto.components.revioLayout.archivedRowMenu',
                    'More actions for {{value0}}',
                    { value0: record.displayName }
                  )}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <Ellipsis className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  const target = deleteAfterMenuCloses.current
                  if (target) {
                    deleteAfterMenuCloses.current = null
                    event.preventDefault()
                    deleteRecord(target)
                  }
                }}
              >
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    deleteAfterMenuCloses.current = record
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {translate('auto.components.revioLayout.deleteArchived', 'Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </>
  )
}
