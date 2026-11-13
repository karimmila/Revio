import type React from 'react'
import { ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import type { SetupStatus } from './workspace-setup-steps'
import { SetupStatusBadge } from './WorkspaceSetupParts'
import { WorkspaceSetupGithubSteps } from './WorkspaceSetupGithubSteps'

function permissionRows(): { name: string; access: string; key: string }[] {
  const readWrite = translate('components.onboarding.workspace.github.readWrite', 'Read and write')
  const readOnly = translate('components.onboarding.workspace.github.readOnly', 'Read-only')
  return [
    {
      key: 'contents',
      name: translate('components.onboarding.workspace.github.contents', 'Contents'),
      access: readWrite
    },
    {
      key: 'pulls',
      name: translate('components.onboarding.workspace.github.pullRequests', 'Pull requests'),
      access: readWrite
    },
    {
      key: 'issues',
      name: translate('components.onboarding.workspace.github.issues', 'Issues'),
      access: readWrite
    },
    {
      key: 'checks',
      name: translate('components.onboarding.workspace.github.checks', 'Checks'),
      access: readOnly
    },
    {
      key: 'statuses',
      name: translate('components.onboarding.workspace.github.statuses', 'Commit statuses'),
      access: readOnly
    },
    {
      key: 'metadata',
      name: translate('components.onboarding.workspace.github.metadata', 'Metadata'),
      access: readOnly
    },
    {
      key: 'workflows',
      name: translate('components.onboarding.workspace.github.workflows', 'Workflows'),
      access: translate('components.onboarding.workspace.github.noAccess', 'No access')
    }
  ]
}

/**
 * The sign-in steps come first and the permission list folds away below them: with the list on
 * top, the device code and "Open GitHub" opened below the fold of a 1440×900 window.
 */
export function WorkspaceSetupGithubStep({ status }: { status: SetupStatus }): React.JSX.Element {
  const settingsLoaded = useAppStore((s) => s.settings !== null)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          {translate(
            'components.onboarding.workspace.github.stepsHeading',
            'Sign in, then install the app on the owners of your projects'
          )}
        </h2>
        <SetupStatusBadge status={status} />
      </div>
      {settingsLoaded ? <WorkspaceSetupGithubSteps /> : null}
      <details data-github-permissions="" className="group text-[13px]">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3.5 transition-transform group-open:rotate-90"
            aria-hidden
          />
          {translate(
            'components.onboarding.workspace.github.whatAccess',
            'What {{name}} can access',
            { name: FORK_PRODUCT_NAME }
          )}
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <dl className="grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 rounded-lg border border-border p-3.5">
            {permissionRows().map((row) => (
              <div key={row.key} className="contents">
                <dt className="text-foreground">{row.name}</dt>
                <dd className="text-muted-foreground">{row.access}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {translate(
              'components.onboarding.workspace.github.appWhyShort',
              'The app never gets Workflows, so a sandbox cannot change CI that runs with your repository’s secrets.'
            )}
          </p>
        </div>
      </details>
    </div>
  )
}
