import type React from 'react'
import { AlertCircle, Check, CircleDashed, ExternalLink, HelpCircle, RefreshCw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'
import { allGithubReposCovered, githubRepoRows } from './revio-cloud-github-view'

type RepoState = CloudGithubStatus['repos'][number]['state']

function RepoStateLabel({ state }: { state: RepoState }): React.JSX.Element {
  switch (state) {
    case 'covered':
      return (
        <span data-github-repo-state={state}>
          <Check className="size-3" aria-hidden />
          {translate('auto.components.revioLayout.settings.githubRepoCovered', 'Covered')}
        </span>
      )
    case 'not-covered':
      return (
        <span data-github-repo-state={state}>
          <CircleDashed className="size-3" aria-hidden />
          {translate('auto.components.revioLayout.settings.githubRepoNotCovered', 'Not covered')}
        </span>
      )
    case 'unknown':
      return (
        <span data-github-repo-state={state}>
          <HelpCircle className="size-3" aria-hidden />
          {translate('auto.components.revioLayout.settings.githubRepoUnknown', 'Unknown')}
        </span>
      )
  }
}

/**
 * This Mac's GitHub repositories as one bordered list, each with whether the app reaches it and,
 * on an owner's first uncovered repository, the install button for that owner.
 */
export function RevioCloudGithubRepos({
  status,
  onInstall,
  onRecheck
}: {
  status: CloudGithubStatus
  onInstall: (owner: string) => void
  onRecheck: () => void
}): React.JSX.Element {
  const pending = status.pendingInstallOwner
  return (
    <div className="flex flex-col gap-2">
      {status.repos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.revioLayout.settings.githubNoRepos',
            'No repository here has its origin on GitHub.'
          )}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {allGithubReposCovered(status) ? (
              <>
                <Check className="size-3 text-status-success" aria-hidden />
                {translate(
                  'auto.components.revioLayout.settings.githubAllCovered',
                  'All repositories covered.'
                )}
              </>
            ) : (
              translate(
                'auto.components.revioLayout.settings.githubReposHeading',
                'Repositories on this Mac'
              )
            )}
          </p>
          <ul data-revio-github-repos="">
            {githubRepoRows(status.repos).map((repo) => (
              <li key={repo.repoId}>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {repo.owner}/{repo.name}
                </span>
                <RepoStateLabel state={repo.state} />
                {repo.offerInstall ? (
                  <button
                    type="button"
                    data-revio-settings-button=""
                    data-size="sm"
                    onClick={() => onInstall(repo.owner)}
                  >
                    {translate(
                      'auto.components.revioLayout.settings.githubInstallOn',
                      'Install on {{value0}}',
                      { value0: repo.owner }
                    )}
                    <ExternalLink className="size-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {status.coverageError ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
          {status.coverageError}
        </p>
      ) : null}
      {pending ? (
        <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            {translate(
              'auto.components.revioLayout.settings.githubInstallPending',
              'Finish the install on GitHub, then come back. If you are not an admin of {{value0}}, GitHub sends its admins a request instead, and the repositories show as covered once they approve.',
              { value0: pending }
            )}
          </p>
          <button
            type="button"
            data-revio-settings-text-button=""
            className="shrink-0 whitespace-nowrap"
            onClick={onRecheck}
          >
            <RefreshCw className="size-3" aria-hidden />
            {translate('auto.components.revioLayout.settings.githubCheckAgain', 'Check again')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
