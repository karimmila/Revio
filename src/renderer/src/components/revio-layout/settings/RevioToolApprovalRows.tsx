import type React from 'react'
import { translate } from '@/i18n/i18n'
import { permissionUpdates } from '../../../../../shared/agent-launch/choices/agent-launch-permission-updates'
import { resolveAgentPermission } from '../../../../../shared/agent-launch/permissions/tui-agent-permission-choice'
import type { AgentPermissionSettings } from '../../../../../shared/agent-launch/permissions/tui-agent-permission-choice'
import { RevioSelect, RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

export type CodexApprovalPolicy = 'default' | 'always_approve'

/** Claude Code asks before tools when its own permission is Ask. */
export function claudeToolApprovalsOn(settings: AgentPermissionSettings): boolean {
  return resolveAgentPermission('claude', settings).choice === 'ask'
}

/** The Codex "Always approve" is Full access; "Default" lets Codex ask. */
export function codexApprovalPolicy(settings: AgentPermissionSettings): CodexApprovalPolicy {
  return resolveAgentPermission('codex', settings).choice === 'full-access'
    ? 'always_approve'
    : 'default'
}

/** The Account rows "Claude Code tool approvals" and "Codex tool approvals", as per-agent
 * permission overrides on top of the Permission mode for every agent. */
export function RevioToolApprovalRows(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  return (
    <>
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.claudeApprovals',
          'Claude Code tool approvals'
        )}
        description={translate(
          'auto.components.revioLayout.settings.claudeApprovalsDescription',
          'Require manual approval before agents can run tools.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.claudeApprovals',
              'Claude Code tool approvals'
            )}
            checked={claudeToolApprovalsOn(settings)}
            onChange={(checked) =>
              update(
                permissionUpdates(settings, {
                  type: 'permission',
                  agent: 'claude',
                  choice: checked ? 'ask' : 'full-access'
                })
              )
            }
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.codexApprovals',
          'Codex tool approvals'
        )}
        control={
          <RevioSelect<CodexApprovalPolicy>
            label={translate(
              'auto.components.revioLayout.settings.codexApprovals',
              'Codex tool approvals'
            )}
            value={codexApprovalPolicy(settings)}
            options={[
              {
                value: 'default',
                label: translate(
                  'auto.components.revioLayout.settings.codexApprovalsDefault',
                  'Default'
                )
              },
              {
                value: 'always_approve',
                label: translate(
                  'auto.components.revioLayout.settings.codexApprovalsAlways',
                  'Always approve'
                )
              }
            ]}
            onChange={(policy) =>
              update(
                permissionUpdates(settings, {
                  type: 'permission',
                  agent: 'codex',
                  choice: policy === 'always_approve' ? 'full-access' : 'ask'
                })
              )
            }
          />
        }
      />
    </>
  )
}
