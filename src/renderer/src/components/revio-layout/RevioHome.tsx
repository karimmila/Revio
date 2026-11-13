import React from 'react'
import { Archive, ArrowDownUp, Folder, Layers, Plus, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import type { Worktree } from '../../../../shared/worktree/types'
import { RevioLineTotal } from './revio-layout'
import { isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { RevioArchivedList } from './RevioArchivedList'
import { RevioHomeRequiredTools } from './RevioHomeRequiredTools'
import { EmptyHome } from './RevioHomeParts'
import { RevioHomeToolbar, revioHomeToolbarMenu } from './RevioHomeToolbar'
import { RevioHomeAsleepRows, RevioHomeConnectCard, useHomeAsleepCloud } from './RevioHomeAsleep'
import { RevioHomeStatusMark } from './RevioStatusMatrix'
import { groupHomeRows, type HomeGroupBy } from './revio-home-groups'
import { usePullRequestTitleForWorktree } from './use-revio-pull-request'
import { getWorktreeCardTitleDisplay } from '@/components/sidebar/workspace-card/identity/worktree-card-title-display'

type SortKey = 'recent' | 'created' | 'name'
type ArchiveFilter = 'active' | 'archived'

function sortRows(rows: Worktree[], sort: SortKey): Worktree[] {
  const sorted = [...rows]
  if (sort === 'name') {
    return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  if (sort === 'created') {
    return sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }
  return sorted.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
}

function WorkspaceRow({
  worktree,
  repoName,
  showRepo
}: {
  worktree: Worktree
  repoName: string
  showRepo: boolean
}): React.JSX.Element {
  // The same name as the sidebar row: the stored name, or the PR's title while that is the branch.
  const reviewTitle = usePullRequestTitleForWorktree(worktree.id)
  const title =
    getWorktreeCardTitleDisplay({
      storedDisplayName: worktree.displayName,
      branchName: worktree.branch.replace(/^refs\/heads\//, ''),
      reviewTitle
    }).trim() || worktree.displayName
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => activateAndRevealWorktree(worktree.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          activateAndRevealWorktree(worktree.id)
        }
      }}
      className="group flex h-10 cursor-default items-center gap-3 border-b border-border pr-2 pl-4 text-[12px] text-foreground/75 transition-colors outline-none hover:bg-accent/40 hover:text-foreground focus-visible:bg-accent/40"
    >
      <RevioHomeStatusMark worktreeId={worktree.id} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <RevioLineTotal worktreeId={worktree.id} />
      {showRepo ? (
        <span className="w-40 shrink-0 truncate text-muted-foreground">{repoName}</span>
      ) : null}
      <button
        type="button"
        aria-label={translate('auto.components.revioLayout.archive', 'Archive')}
        onClick={(event) => {
          event.stopPropagation()
          runWorktreeDelete(worktree.id)
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
      >
        <Archive className="size-3.5" />
      </button>
    </div>
  )
}

/** Home: every workspace in one table, with the toolbar in the title row. */
export default function RevioHome(): React.JSX.Element {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const cloud = useAppStore((s) => s.settings?.revioLocation === 'cloud')
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<ArchiveFilter>('active')
  const [sort, setSort] = React.useState<SortKey>('recent')
  const [display, setDisplay] = React.useState<'repo' | 'compact'>('repo')
  const [projectId, setProjectId] = React.useState('all')
  const [groupBy, setGroupBy] = React.useState<HomeGroupBy>('none')
  const statuses = useAppStore((s) => s.workspaceStatuses)
  const repoNames = React.useMemo(
    () =>
      new Map(
        repos.map((repo) => [repo.id, repo.displayName || repo.path.split('/').pop() || repo.path])
      ),
    [repos]
  )
  // Each location's Home lists only its own workspaces, as its sidebar does. A cloud workspace is
  // its repository's root, so the main-worktree rule applies to this Mac only.
  const all = React.useMemo(() => {
    const cloudRepoIds = new Set(
      repos.filter((repo) => isCloudRepo(repo, cloudEnvironmentIds)).map((repo) => repo.id)
    )
    return Object.values(worktreesByRepo)
      .flat()
      .filter((worktree) =>
        cloud
          ? cloudRepoIds.has(worktree.repoId)
          : !cloudRepoIds.has(worktree.repoId) && !worktree.isMainWorktree
      )
  }, [cloud, cloudEnvironmentIds, repos, worktreesByRepo])
  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const visible = all.filter(
      (worktree) =>
        Boolean(worktree.isArchived) === (filter === 'archived') &&
        (projectId === 'all' || worktree.repoId === projectId) &&
        (!needle ||
          worktree.displayName.toLowerCase().includes(needle) ||
          (worktree.branch ?? '').toLowerCase().includes(needle))
    )
    return sortRows(visible, sort)
  }, [all, filter, projectId, query, sort])
  const groups = React.useMemo(
    () => groupHomeRows(rows, groupBy, statuses, repoNames),
    [groupBy, repoNames, rows, statuses]
  )
  const projectOptions = React.useMemo(
    () => [
      {
        value: 'all',
        label: translate('auto.components.revioLayout.allProjects', 'All projects')
      },
      ...[...new Set(all.map((worktree) => worktree.repoId))].map((repoId) => ({
        value: repoId,
        label: repoNames.get(repoId) ?? repoId
      }))
    ],
    [all, repoNames]
  )
  const asleep = useHomeAsleepCloud(cloud, query, projectId)
  const filtered = query.trim() !== '' || projectId !== 'all'
  const clearFilters = (): void => {
    setQuery('')
    setProjectId('all')
  }

  const menus = [
    revioHomeToolbarMenu({
      id: 'project',
      icon: Folder,
      value: projectId,
      onChange: setProjectId,
      options: projectOptions
    }),
    revioHomeToolbarMenu<ArchiveFilter>({
      id: 'filter',
      icon: Archive,
      main: true,
      value: filter,
      onChange: setFilter,
      options: [
        { value: 'active', label: translate('auto.components.revioLayout.active', 'Active') },
        {
          value: 'archived',
          label: translate('auto.components.revioLayout.onlyArchived', 'Only archived')
        }
      ]
    }),
    revioHomeToolbarMenu<SortKey>({
      id: 'sort',
      icon: ArrowDownUp,
      main: true,
      value: sort,
      onChange: setSort,
      options: [
        {
          value: 'recent',
          label: translate('auto.components.revioLayout.lastActive', 'Last active')
        },
        { value: 'created', label: translate('auto.components.revioLayout.created', 'Created') },
        { value: 'name', label: translate('auto.components.revioLayout.name', 'Name') }
      ]
    }),
    revioHomeToolbarMenu<HomeGroupBy>({
      id: 'group',
      icon: Layers,
      value: groupBy,
      onChange: setGroupBy,
      options: [
        {
          value: 'none',
          label: translate('auto.components.revioLayout.noGrouping', 'No grouping')
        },
        {
          value: 'status',
          label: translate('auto.components.revioLayout.groupByStatus', 'Group by status')
        },
        {
          value: 'project',
          label: translate('auto.components.revioLayout.groupByProject', 'Group by project')
        }
      ]
    }),
    revioHomeToolbarMenu<'repo' | 'compact'>({
      id: 'display',
      icon: SlidersHorizontal,
      value: display,
      onChange: setDisplay,
      options: [
        { value: 'repo', label: translate('auto.components.revioLayout.display', 'Display') },
        {
          value: 'compact',
          label: translate('auto.components.revioLayout.hideRepository', 'Hide repository')
        }
      ]
    })
  ]
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background">
      <RevioHomeToolbar
        query={query}
        onQueryChange={setQuery}
        filtered={filtered}
        onClearFilters={clearFilters}
        menus={menus}
        onCreate={openWorkspaceCreationComposerWithTourHandoff}
      />
      <RevioHomeRequiredTools />
      {filter === 'archived' ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
          <RevioArchivedList cloud={cloud} query={query} showRepo={display === 'repo'} />
        </div>
      ) : !cloud && all.length === 0 && repos.length === 0 ? (
        <EmptyHome />
      ) : all.length === 0 && asleep.length === 0 && !filtered ? (
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={openWorkspaceCreationComposerWithTourHandoff}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-accent/50"
          >
            <Plus className="size-3.5" />
            {translate('auto.components.revioLayout.createWorkspace', 'Create a workspace')}
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
          {cloud ? <RevioHomeConnectCard /> : null}
          {groups.map((group) => (
            <React.Fragment key={group.key}>
              {group.label !== null ? (
                <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-1.5 text-[11.5px] font-medium text-muted-foreground">
                  {group.label}
                  <span className="ml-1.5 tabular-nums">{group.rows.length}</span>
                </div>
              ) : null}
              {group.rows.map((worktree) => (
                <WorkspaceRow
                  key={worktree.id}
                  worktree={worktree}
                  repoName={repoNames.get(worktree.repoId) ?? ''}
                  showRepo={display === 'repo'}
                />
              ))}
            </React.Fragment>
          ))}
          <RevioHomeAsleepRows
            records={asleep}
            repoNames={repoNames}
            showRepo={display === 'repo'}
          />
          {rows.length === 0 && asleep.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-[12px] text-muted-foreground">
              {translate('auto.components.revioLayout.noMatches', 'No workspaces match.')}
              {filtered ? (
                <button type="button" className="underline" onClick={clearFilters}>
                  {translate('auto.components.revioLayout.clearFilters', 'Clear filters')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
