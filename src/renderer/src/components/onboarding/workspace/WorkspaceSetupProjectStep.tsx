import { useMemo } from 'react'
import type React from 'react'
import { Cloud, FolderOpen, Globe, Laptop } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useGithubSignedOut } from '@/lib/github-sign-in-state'
import { isHomeFolderProject } from '@/lib/revio-create-default-repo'
import type { SetupLocation, SetupStatus } from './workspace-setup-steps'
import { SetupStatusBadge } from './WorkspaceSetupParts'

const choiceClass =
  'flex min-h-[72px] flex-1 basis-56 items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-left text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

function LocationChoice({
  value,
  selected,
  onSelect,
  icon: Icon,
  title,
  description
}: {
  value: SetupLocation
  selected: boolean
  onSelect: (value: SetupLocation) => void
  icon: typeof Cloud
  title: string
  description: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cn(choiceClass, selected && 'border-foreground/60 bg-accent/40')}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-col gap-1">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

export function WorkspaceSetupProjectStep({
  status,
  location,
  onLocationChange
}: {
  status: SetupStatus
  location: SetupLocation
  onLocationChange: (location: SetupLocation) => void
}): React.JSX.Element {
  const allRepos = useAppStore((s) => s.repos)
  // The GitHub step comes after this one, so "pick one of yours" is only true once signed in.
  const githubSignedOut = useGithubSignedOut() === true
  // The "~" folder Orca seeds on first run is not one the person added (same rule as the status).
  const repos = useMemo(() => allRepos.filter((repo) => !isHomeFolderProject(repo)), [allRepos])
  const names = repos.map((repo) => repo.displayName || repo.path.split('/').pop() || repo.path)
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            {translate('components.onboarding.workspace.project.open', 'Open a project')}
          </h2>
          <SetupStatusBadge
            status={status}
            label={
              status === 'connected'
                ? translate('components.onboarding.workspace.project.count', '{{count}} added', {
                    count: repos.length
                  })
                : translate('components.onboarding.workspace.project.none', 'No project yet')
            }
          />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={choiceClass}
            onClick={() => useAppStore.getState().openModal('add-repo', { startStep: 'clone' })}
          >
            <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                {translate(
                  'components.onboarding.workspace.project.github',
                  'Open a GitHub repository'
                )}
              </span>
              <span className="text-muted-foreground">
                {githubSignedOut
                  ? translate(
                      'components.onboarding.workspace.project.githubUrlHint',
                      'Clone it from a URL.'
                    )
                  : translate(
                      'components.onboarding.workspace.project.githubHint',
                      'Clone it from a URL or pick one of yours.'
                    )}
              </span>
            </span>
          </button>
          <button
            type="button"
            className={choiceClass}
            onClick={() => void useAppStore.getState().addRepo()}
          >
            <FolderOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                {translate('components.onboarding.workspace.project.folder', 'Open a local folder')}
              </span>
              <span className="text-muted-foreground">
                {translate(
                  'components.onboarding.workspace.project.folderHint',
                  'A Git repository that is already on this Mac.'
                )}
              </span>
            </span>
          </button>
        </div>
        {names.length > 0 ? (
          <p className="text-[12px] text-muted-foreground">{names.join(', ')}</p>
        ) : null}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          {translate('components.onboarding.workspace.project.where', 'New workspaces run')}
        </h2>
        <div
          role="radiogroup"
          aria-label={translate(
            'components.onboarding.workspace.project.where',
            'New workspaces run'
          )}
          className="flex flex-wrap gap-2.5"
        >
          <LocationChoice
            value="cloud"
            selected={location === 'cloud'}
            onSelect={onLocationChange}
            icon={Cloud}
            title={translate('components.onboarding.workspace.project.cloud', 'In the cloud')}
            description={translate(
              'components.onboarding.workspace.project.cloudHint',
              'One Vercel Sandbox per workspace. Your Mac stays free.'
            )}
          />
          <LocationChoice
            value="local"
            selected={location === 'local'}
            onSelect={onLocationChange}
            icon={Laptop}
            title={translate('components.onboarding.workspace.project.mac', 'On this Mac')}
            description={translate(
              'components.onboarding.workspace.project.macHint',
              'A Git worktree in a folder on this Mac.'
            )}
          />
        </div>
        <p className="text-[12px] text-muted-foreground">
          {translate(
            'components.onboarding.workspace.project.switchLater',
            'You can switch at any time from the sidebar.'
          )}
        </p>
      </section>
    </div>
  )
}
