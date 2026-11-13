import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions/repo-actions-store', () => ({ readRepoActions: vi.fn() }))

import {
  orcaCliCommand,
  repoActionsGenericInstruction,
  repoActionsInstruction,
  summarizeActionScript
} from './revio-repo-actions-instruction'
import { withRepoActionsInstruction } from './revio-repo-actions-policy'
import { claudeSystemPromptOptions } from '../claude-accounts/claude-structured-auth-policy'
import { codexInstructionArgs } from './revio-agent-instructions'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

const action = (name: string, script = `echo ${name}`) => ({
  name,
  script,
  targets: ['local' as const]
})

describe('repository actions instruction', () => {
  it('lists each action with where it runs and its first script line, then how to run one', () => {
    const text = repoActionsInstruction(
      [action('Claim tunnel', '#!/bin/bash\n\nngrok http 3000\n')],
      'orca'
    )
    expect(text).toContain('- "Claim tunnel" (local): ngrok http 3000')
    expect(text).toContain('orca action run "<name>"')
    expect(text).toContain('orca terminal read --terminal <handle>')
  })

  it('stays bounded for many or long actions', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      action(`Action ${index} ${'n'.repeat(100)}`, 'x'.repeat(500))
    )
    const text = repoActionsInstruction(many, 'orca')
    expect(text.split('\n').filter((line) => line.startsWith('- "'))).toHaveLength(12)
    expect(text).toContain('… and 28 more (see `orca action list`)')
    expect(text.length).toBeLessThan(3000)
    expect(summarizeActionScript('y'.repeat(200))).toHaveLength(80)
  })

  it('falls back to the generic note when the repository has no actions', () => {
    expect(repoActionsInstruction([], 'orca')).toBe(repoActionsGenericInstruction('orca'))
    expect(repoActionsGenericInstruction('orca')).toContain('orca action list')
  })
})

describe('Claude and Codex get the note', () => {
  it('appends the listed actions to the Claude system prompt of a workspace-layout chat', () => {
    const policy = withRepoActionsInstruction(
      { account: 'managed', systemPromptAppend: 'Be brief.' },
      { revioLayout: true },
      () => [{ id: 'r1', path: '/repo' }],
      () => ({
        actions: [{ id: 'a', shared: true, ...action('Claim tunnel') }],
        runMode: 'concurrent',
        previewUrls: [],
        sharedFile: '',
        sharedFileName: '.orca/actions.toml',
        sharedError: null
      })
    )
    const append = claudeSystemPromptOptions(policy, 'r1').systemPrompt?.append ?? ''
    expect(append.startsWith('Be brief.\n\nThis workspace has repository actions')).toBe(true)
    expect(append).toContain('"Claim tunnel"')
    expect(claudeSystemPromptOptions(policy, 'unknown').systemPrompt?.append).toBe(
      `Be brief.\n\n${repoActionsGenericInstruction()}`
    )
  })

  it('adds nothing outside the workspace layout', () => {
    const policy = withRepoActionsInstruction({ account: 'managed' }, {}, () => [])
    expect(claudeSystemPromptOptions(policy, 'r1')).toEqual({})
  })

  it('gives Codex only the generic sentence', () => {
    const [flag, value] = codexInstructionArgs({
      revioLayout: true,
      revioStackedPullRequests: false
    })
    expect(flag).toBe('-c')
    expect(value).toBe(`developer_instructions=${JSON.stringify(repoActionsGenericInstruction())}`)
  })
})

describe('the CLI name agents are told to run', () => {
  it("is this app's command, never the upstream alias", () => {
    // A development build answers with its own dev command; a packaged one with the app's.
    expect(['orca-dev', FORK_CLI_COMMAND_NAME]).toContain(orcaCliCommand())
    expect(repoActionsGenericInstruction()).not.toMatch(/`orca action/)
  })
})
