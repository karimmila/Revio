import { describe, expect, it } from 'vitest'
import { makeAutomation } from './automations-page-fixtures'
import { buildAutomationDuplicateDraft } from './automation-row-copy-actions'

describe('routine Duplicate', () => {
  it('names the copy and keeps the prompt, agent, target and schedule', () => {
    const draft = buildAutomationDuplicateDraft(
      makeAutomation({
        name: 'Nightly',
        launchPreferences: { model: 'opus' },
        agentArgs: '--x'
      })
    )
    expect(draft).toMatchObject({
      name: 'Copy of Nightly',
      prompt: 'Run the nightly sweep',
      agentId: 'claude',
      projectId: 'repo-1',
      workspaceMode: 'new_per_run',
      preset: 'daily',
      time: '09:00',
      savedSchedule: null
    })
    expect(draft).not.toHaveProperty('launchPreferences')
    expect(draft).not.toHaveProperty('agentArgs')
  })
})
