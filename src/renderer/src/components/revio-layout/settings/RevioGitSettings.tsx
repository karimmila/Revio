import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { BranchPrefixStrategy } from '../../../../../shared/ui-chrome-types'
import { RevioSelect, RevioSettingRow, RevioSettingsPage, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { RevioGitIdentityRow } from './RevioGitIdentityRow'

function BranchPrefixControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const gitUsername = useAppStore((s) => s.repos[0]?.gitUsername ?? '')
  const [draft, setDraft] = React.useState(settings.branchPrefixCustom)
  const strategies: { value: BranchPrefixStrategy; label: string }[] = [
    {
      value: 'git-username',
      label: translate('auto.components.revioLayout.settings.prefixUsername', 'GitHub username')
    },
    {
      value: 'custom',
      label: translate('auto.components.revioLayout.settings.prefixCustom', 'Custom')
    },
    {
      value: 'none',
      label: translate('auto.components.revioLayout.settings.prefixNone', 'None')
    }
  ]
  const prefix =
    settings.branchPrefix === 'git-username'
      ? gitUsername
        ? `${gitUsername}/`
        : ''
      : settings.branchPrefix === 'custom'
        ? draft
        : ''
  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={settings.branchPrefix}
        onValueChange={(next) => {
          const match = strategies.find((strategy) => strategy.value === next)
          if (match) {
            update({ branchPrefix: match.value })
          }
        }}
      >
        {strategies.map((strategy) => (
          <label key={strategy.value} className="flex items-center gap-2">
            <RadioGroupItem value={strategy.value} />
            {strategy.label}
            {strategy.value === 'custom' && settings.branchPrefix === 'custom' ? (
              <Input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  update({ branchPrefixCustom: event.target.value })
                }}
                placeholder={translate(
                  'auto.components.revioLayout.settings.prefixPlaceholder',
                  'e.g. feature/ or myname-'
                )}
                className="ml-2 h-7 w-56"
              />
            ) : null}
          </label>
        ))}
      </RadioGroup>
      <div data-revio-setting-hint="">
        {translate('auto.components.revioLayout.settings.prefixPreview', 'Preview: {{value0}}', {
          value0: `${prefix}tokyo`
        })}
      </div>
    </div>
  )
}

export function RevioGitSettings(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  return (
    <RevioSettingsPage title={translate('auto.components.revioLayout.settings.git', 'Git')}>
      <RevioGitIdentityRow />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.openPrsIn', 'Open pull requests in')}
        control={
          <RevioSelect
            label={translate(
              'auto.components.revioLayout.settings.openPrsIn',
              'Open pull requests in'
            )}
            value={settings.revioOpenPullRequestsIn ?? 'github'}
            options={[
              {
                value: 'github',
                label: translate('auto.components.revioLayout.settings.openInGithub', 'GitHub')
              },
              {
                value: 'linear',
                label: translate('auto.components.revioLayout.settings.openInLinear', 'Linear')
              },
              {
                value: 'graphite',
                label: translate('auto.components.revioLayout.settings.openInGraphite', 'Graphite')
              },
              {
                value: 'app',
                label: translate(
                  'auto.components.revioLayout.settings.openInApp',
                  '{{productName}}'
                )
              }
            ]}
            onChange={(value) => update({ revioOpenPullRequestsIn: value })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.prWorkspaceLink',
          'Include link to workspace in PR description'
        )}
        description={translate(
          'auto.components.revioLayout.settings.prWorkspaceLinkAppDescription',
          'Create PR adds a link that opens this workspace in this app.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.prWorkspaceLink',
              'Include link to workspace in PR description'
            )}
            checked={settings.revioPrWorkspaceLink === true}
            onChange={(checked) => update({ revioPrWorkspaceLink: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.branchPrefix', 'Branch name prefix')}
        description={translate(
          'auto.components.revioLayout.settings.branchPrefixDescription',
          'Prefix for new workspace branch names.'
        )}
        below={<BranchPrefixControl />}
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.autoRename',
          'Automatically rename new branches'
        )}
        description={translate(
          'auto.components.revioLayout.settings.autoRenameDescription',
          'Name the branch, and the workspace with it, from the first task the agent works on.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.autoRename',
              'Automatically rename new branches'
            )}
            checked={settings.autoRenameBranchFromWork}
            onChange={(checked) => update({ autoRenameBranchFromWork: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.renameWorkspaceWithBranch',
          'Rename workspace when branch is named'
        )}
        description={translate(
          'auto.components.revioLayout.settings.renameWorkspaceWithBranchDescription',
          'When the branch gets its name from the first task, give the workspace the same name.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.renameWorkspaceWithBranch',
              'Rename workspace when branch is named'
            )}
            checked={settings.revioRenameWorkspaceWithBranch !== false}
            onChange={(checked) => update({ revioRenameWorkspaceWithBranch: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.deleteBranch',
          'Delete branch on archive'
        )}
        description={translate(
          'auto.components.revioLayout.settings.deleteBranchDescription',
          'Delete the local branch when archiving a workspace. The remote branch stays.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.deleteBranch',
              'Delete branch on archive'
            )}
            checked={settings.revioDeleteBranchOnArchive === true}
            onChange={(checked) => update({ revioDeleteBranchOnArchive: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.archiveOnMerge', 'Archive on merge')}
        description={translate(
          'auto.components.revioLayout.settings.archiveOnMergeDescription',
          'Archive a workspace after you merge its pull request from the PR bar.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.archiveOnMerge',
              'Archive on merge'
            )}
            checked={settings.revioArchiveOnMerge === true}
            onChange={(checked) => update({ revioArchiveOnMerge: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.upstream',
          'Set upstream on plain git push'
        )}
        description={translate(
          'auto.components.revioLayout.settings.upstreamDescription',
          'New workspaces set push.autoSetupRemote, so a plain git push creates the remote branch and tracks it.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.upstream',
              'Set upstream on plain git push'
            )}
            checked={settings.revioSetUpstreamOnPush !== false}
            onChange={(checked) => update({ revioSetUpstreamOnPush: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.autoMerge', 'Automerge')}
        description={translate(
          'auto.components.revioLayout.settings.autoMergeDescription',
          'Show an automerge button in the PR bar when checks are pending. Needs auto-merge allowed in the GitHub repository settings; not for stacked pull requests.'
        )}
        control={
          <RevioSwitch
            label={translate('auto.components.revioLayout.settings.autoMerge', 'Automerge')}
            checked={settings.revioAutoMerge === true}
            onChange={(checked) => update({ revioAutoMerge: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.optionalChecks',
          'Treat optional checks as blocking'
        )}
        description={translate(
          'auto.components.revioLayout.settings.optionalChecksDescription',
          'Wait for checks GitHub does not require before showing a PR as ready to merge.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.optionalChecks',
              'Treat optional checks as blocking'
            )}
            checked={settings.revioOptionalChecksBlocking === true}
            onChange={(checked) => update({ revioOptionalChecksBlocking: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.stacked', 'Use GitHub stacked PRs')}
        description={translate(
          'auto.components.revioLayout.settings.stackedDescription',
          'Tell agents they can split one feature into a stack of pull requests with gh stack.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.stacked',
              'Use GitHub stacked PRs'
            )}
            checked={settings.revioStackedPullRequests !== false}
            onChange={(checked) => update({ revioStackedPullRequests: checked })}
          />
        }
      />
    </RevioSettingsPage>
  )
}
