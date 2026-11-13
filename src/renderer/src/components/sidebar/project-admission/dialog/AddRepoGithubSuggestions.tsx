import React from 'react'
import { Lock } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useGithubSignedOut } from '@/lib/github-sign-in-state'
import {
  filterGithubRepos,
  type GithubRepoSummary
} from '../../../../../../shared/github-repo-list'

/**
 * "Clone from GitHub": the signed-in person's repositories under the URL field (the ones the
 * GitHub App reaches, else gh's list), filtered by what is typed. Picking one fills the URL.
 */
export function AddRepoGithubSuggestions({
  query,
  disabled,
  onPick
}: {
  query: string
  disabled: boolean
  onPick: (url: string) => void
}): React.JSX.Element | null {
  const [repos, setRepos] = React.useState<GithubRepoSummary[]>([])
  const signedOut = useGithubSignedOut() === true
  React.useEffect(() => {
    let live = true
    void window.api.githubRepos
      ?.list()
      .then((list) => {
        if (live) {
          setRepos(list)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  // A full URL needs no suggestions.
  const typed = query.trim()
  const matches = /^(https?:|git@)/.test(typed) ? [] : filterGithubRepos(repos, typed)
  if (matches.length === 0) {
    // Signed out there is nothing to pick from; say where the list comes from.
    return signedOut && repos.length === 0 ? (
      <p data-github-repos-signed-out="" className="text-[11px] text-muted-foreground">
        {translate(
          'auto.components.sidebar.AddRepoSteps.githubSignInToPick',
          'Sign in with GitHub in Settings > Account to pick from your repositories here.'
        )}
      </p>
    ) : null
  }
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground">
        {translate('auto.components.sidebar.AddRepoSteps.githubRecent', 'Your GitHub repositories')}
      </div>
      <div className="scrollbar-sleek max-h-40 overflow-y-auto rounded-md border border-border">
        {matches.map((repo) => (
          <button
            key={repo.nameWithOwner}
            type="button"
            disabled={disabled}
            onClick={() => onPick(`${repo.url}.git`)}
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-accent"
          >
            <span className="truncate">{repo.nameWithOwner}</span>
            {repo.isPrivate ? <Lock className="size-3 shrink-0 text-muted-foreground" /> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
