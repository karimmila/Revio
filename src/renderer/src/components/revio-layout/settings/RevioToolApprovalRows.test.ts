import { expect, it } from 'vitest'
import { permissionUpdates } from '../../../../../shared/agent-launch/choices/agent-launch-permission-updates'
import type { AgentLaunchSettingsSource } from '../../../../../shared/agent-launch/choices/agent-launch-settings'
import { claudeToolApprovalsOn, codexApprovalPolicy } from './RevioToolApprovalRows'

const base = { agentPermissionDefault: 'full-access' } as const

it('reads each agent from its own override over the all-agents mode', () => {
  expect(claudeToolApprovalsOn(base)).toBe(false)
  expect(codexApprovalPolicy(base)).toBe('always_approve')
  const settings = { ...base, agentPermissionOverrides: { claude: 'ask', codex: 'ask' } } as const
  expect(claudeToolApprovalsOn(settings)).toBe(true)
  expect(codexApprovalPolicy(settings)).toBe('default')
})

it('turning Claude approvals on overrides only Claude', () => {
  const source: AgentLaunchSettingsSource = { ...base }
  const next = {
    ...source,
    ...permissionUpdates(source, { type: 'permission', agent: 'claude', choice: 'ask' })
  }
  expect(claudeToolApprovalsOn(next)).toBe(true)
  expect(codexApprovalPolicy(next)).toBe('always_approve')
})
