import React from 'react'
import { toast } from 'sonner'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import {
  cloudBuildPredatesBaseLayer,
  currentSnapshot,
  type CloudBuild,
  type CloudRepoConfig
} from '../../../../../shared/cloud/cloud-types'
import { RevioSelect, RevioSettingRow, RevioSettingsGroup } from './RevioSettingsRows'
import { useCloudRepo } from './use-cloud-repo'

function cleanIpcError(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function elapsed(build: CloudBuild): string {
  const seconds = Math.round(((build.finishedAt ?? Date.now()) - build.startedAt) / 1000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`
}

function buildSummary(build: CloudBuild | undefined): string {
  if (!build) {
    return translate('auto.components.revioLayout.settings.cloudNoBuild', 'Not built yet')
  }
  const commit = build.commit ? build.commit.slice(0, 7) : ''
  switch (build.state) {
    case 'running':
      return `${build.step}…`
    case 'succeeded':
      return translate(
        'auto.components.revioLayout.settings.cloudBuilt',
        'Built {{value0}} from {{value1}} in {{value2}}',
        {
          value0: new Date(build.finishedAt ?? build.startedAt).toLocaleString(getIntlLocale()),
          value1: commit,
          value2: elapsed(build)
        }
      )
    case 'canceled':
      return translate('auto.components.revioLayout.settings.cloudCanceled', 'Canceled')
    case 'failed':
      return translate(
        'auto.components.revioLayout.settings.cloudFailed',
        'Failed during "{{value0}}"',
        { value0: build.step }
      )
  }
}

function ScriptField({
  label,
  description,
  placeholder,
  value,
  onChange
}: {
  label: string
  description: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <RevioSettingRow
      label={label}
      description={description}
      below={
        <Textarea
          value={value}
          rows={5}
          spellCheck={false}
          variant="code"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      }
    />
  )
}

/**
 * The repository's cloud setup: three scripts and the build that turns the first one into the
 * snapshot every cloud workspace starts from.
 */
export function RevioCloudRepoSettings({ repoId }: { repoId: string }): React.JSX.Element {
  const { state, log, error, save, build, cancel, showLog } = useCloudRepo(repoId)
  const [draft, setDraft] = React.useState<CloudRepoConfig | null>(null)
  const [logOpen, setLogOpen] = React.useState(false)
  const logRef = React.useRef<HTMLPreElement>(null)
  const config = draft ?? state?.config ?? null
  const latest = state?.builds[0]
  const running = latest?.state === 'running'
  const ready = state ? currentSnapshot(state) : null
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])
  if (!state || !config) {
    return (
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.cloud', 'Cloud')}
      />
    )
  }
  const set = (patch: Partial<CloudRepoConfig>): void => setDraft({ ...config, ...patch })
  return (
    <>
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.cloud', 'Cloud')}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.cloudBuild', 'Cloud build')}
        description={
          error
            ? cleanIpcError(error)
            : state.github
              ? buildSummary(latest)
              : translate(
                  'auto.components.revioLayout.settings.cloudNeedsGithub',
                  'Cloud workspaces need a repository whose origin is on GitHub.'
                )
        }
        hint={
          ready && latest?.id !== ready.id
            ? translate(
                'auto.components.revioLayout.settings.cloudUsing',
                'New workspaces use the build from {{value0}}.',
                {
                  value0: new Date(ready.finishedAt ?? ready.startedAt).toLocaleString(
                    getIntlLocale()
                  )
                }
              )
            : ready && !running && cloudBuildPredatesBaseLayer(ready)
              ? translate(
                  'auto.components.revioLayout.settings.cloudBuildOutdated',
                  'Rebuild to get the latest desktop tools.'
                )
              : undefined
        }
        control={
          <>
            {latest ? (
              <button
                type="button"
                data-revio-settings-text-button=""
                onClick={() => {
                  setLogOpen((open) => !open)
                  showLog(latest.id)
                }}
              >
                {logOpen
                  ? translate('auto.components.revioLayout.settings.cloudHideLog', 'Hide log')
                  : translate('auto.components.revioLayout.settings.cloudShowLog', 'Show log')}
              </button>
            ) : null}
            {running ? (
              <button type="button" data-revio-settings-button="" onClick={cancel}>
                {translate('auto.components.revioLayout.cancel', 'Cancel')}
              </button>
            ) : (
              <button
                type="button"
                data-revio-settings-button=""
                disabled={!state.github}
                onClick={() => {
                  setLogOpen(true)
                  build()
                }}
              >
                {ready
                  ? translate('auto.components.revioLayout.settings.cloudRebuild', 'Rebuild')
                  : translate('auto.components.revioLayout.settings.cloudBuildNow', 'Build')}
              </button>
            )}
          </>
        }
        below={
          logOpen ? (
            <pre ref={logRef} data-revio-build-log="" className="scrollbar-sleek">
              {log ||
                translate('auto.components.revioLayout.settings.cloudLogEmpty', 'No output yet')}
            </pre>
          ) : undefined
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.cloudNetwork', 'Network')}
        description={translate(
          'auto.components.revioLayout.settings.cloudNetworkDescription',
          'What cloud workspaces may reach. Allowlist (the default): this repository on GitHub, Claude, read-only package registries, Ubuntu and Docker mirrors, and the domains below. Open: any host. Builds can reach any site so installs work; workspaces follow this setting.'
        )}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.cloudNetwork', 'Network')}
            value={config.network ?? 'allowlist'}
            options={[
              {
                value: 'open',
                label: translate('auto.components.revioLayout.settings.networkOpen', 'Open')
              },
              {
                value: 'allowlist',
                label: translate(
                  'auto.components.revioLayout.settings.networkAllowlist',
                  'Allowlist'
                )
              }
            ]}
            onChange={(network) => set({ network })}
          />
        }
        below={
          (config.network ?? 'allowlist') === 'allowlist' ? (
            <Textarea
              value={(config.extraDomains ?? []).join('\n')}
              rows={3}
              spellCheck={false}
              variant="code"
              placeholder={translate(
                'auto.components.revioLayout.settings.extraDomainsPlaceholder',
                'Extra domains, one per line (api.example.com, *.example.com)'
              )}
              onChange={(event) =>
                set({
                  extraDomains: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                })
              }
            />
          ) : undefined
        }
      />
      <ScriptField
        label={translate('auto.components.revioLayout.settings.cloudInstall', 'Install script')}
        description={translate(
          'auto.components.revioLayout.settings.cloudInstallDescription',
          "Runs once per build in the repository's folder, after {{productName}}'s base tools. Its result is saved, so new workspaces start with it done."
        )}
        placeholder={translate(
          'auto.components.revioLayout.settings.cloudInstallPlaceholder',
          'pnpm install'
        )}
        value={config.installScript}
        onChange={(installScript) => set({ installScript })}
      />
      <ScriptField
        label={translate('auto.components.revioLayout.settings.cloudSetup', 'Cloud setup script')}
        description={translate(
          'auto.components.revioLayout.settings.cloudSetupDescription',
          'Runs in each new cloud workspace once its branch is checked out.'
        )}
        placeholder={translate(
          'auto.components.revioLayout.settings.cloudSetupPlaceholder',
          'docker compose up -d && pnpm dev'
        )}
        value={config.setupScript}
        onChange={(setupScript) => set({ setupScript })}
      />
      <ScriptField
        label={translate('auto.components.revioLayout.settings.cloudWake', 'Wake script')}
        description={translate(
          'auto.components.revioLayout.settings.cloudWakeDescription',
          'Runs each time a stopped cloud workspace resumes. Files survive a stop; running programs do not.'
        )}
        placeholder={translate(
          'auto.components.revioLayout.settings.cloudWakePlaceholder',
          'sudo dockerd >/tmp/dockerd.log 2>&1 &'
        )}
        value={config.wakeScript}
        onChange={(wakeScript) => set({ wakeScript })}
      />
      <div className="flex justify-end pt-3">
        <button
          type="button"
          data-revio-settings-button=""
          disabled={!draft}
          onClick={() =>
            void save(config).then(() => {
              setDraft(null)
              toast.success(
                translate('auto.components.revioLayout.settings.cloudSaved', 'Cloud scripts saved')
              )
            })
          }
        >
          {translate('auto.components.revioLayout.settings.cloudSave', 'Save cloud scripts')}
        </button>
      </div>
    </>
  )
}
