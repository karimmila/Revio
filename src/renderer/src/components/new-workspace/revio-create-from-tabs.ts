import { CircleDot, GitPullRequest } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { SmartNameMode } from '../../../../shared/new-workspace/smart-workspace-source-results'
import type { GitHubWorkItem } from '../../../../shared/github/work-item-types'
import type { SmartWorkspaceNameModeOption } from './smart-workspace-localized-options'

export type CreateFromTab = SmartWorkspaceNameModeOption & {
  /** Unique per tab: the GitHub source shows as two tabs. */
  key: string
  githubKind: GitHubWorkItem['type'] | null
}

/**
 * The Create from tabs: Pull requests, Branches and Issues, then Linear and a plain name.
 * GitHub becomes two tabs that share one search and filter its results by kind. GitLab and Jira
 * are not offered: the workspace layout has no sign-in for them.
 */
export function revioCreateFromTabs(
  modes: readonly SmartWorkspaceNameModeOption[]
): CreateFromTab[] {
  const mode = (id: SmartNameMode): SmartWorkspaceNameModeOption | undefined =>
    modes.find((option) => option.id === id)
  const plain = (id: SmartNameMode): CreateFromTab[] => {
    const option = mode(id)
    return option ? [{ ...option, key: id, githubKind: null }] : []
  }
  const github = mode('github')
  const branches = mode('branches')
  return [
    ...plain('smart'),
    ...(github
      ? [
          {
            ...github,
            key: 'github:pr',
            githubKind: 'pr' as const,
            Icon: GitPullRequest,
            label: translate('auto.components.revioLayout.createFromPullRequests', 'Pull requests')
          }
        ]
      : []),
    ...(branches
      ? [
          {
            ...branches,
            key: 'branches',
            githubKind: null,
            label: translate('auto.components.revioLayout.createFromBranches', 'Branches')
          }
        ]
      : []),
    ...(github
      ? [
          {
            ...github,
            key: 'github:issue',
            githubKind: 'issue' as const,
            Icon: CircleDot,
            label: translate('auto.components.revioLayout.createFromIssues', 'Issues')
          }
        ]
      : []),
    ...plain('linear'),
    ...plain('text')
  ]
}

export function activeCreateFromTabKey(
  mode: SmartNameMode,
  githubKind: GitHubWorkItem['type'] | null
): string {
  return mode === 'github' ? `github:${githubKind ?? 'pr'}` : mode
}

/** The tab Tab (step 1) or ⇧Tab (step -1) moves to, wrapping at the ends. */
export function steppedCreateFromTab(
  tabs: readonly CreateFromTab[],
  activeKey: string,
  step: 1 | -1
): CreateFromTab | null {
  if (tabs.length === 0) {
    return null
  }
  const index = tabs.findIndex((tab) => tab.key === activeKey)
  return tabs.at((index + step + tabs.length) % tabs.length) ?? null
}
