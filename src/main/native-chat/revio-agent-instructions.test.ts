import { describe, expect, it } from 'vitest'
import {
  STACKED_PULL_REQUESTS_INSTRUCTION,
  codexInstructionArgs,
  revioAgentInstructions,
  revioRepoAgentInstructions
} from './revio-agent-instructions'
import { repoActionsGenericInstruction } from './revio-repo-actions-instruction'

describe('Agent instructions', () => {
  it('adds nothing outside the workspace layout', () => {
    expect(revioAgentInstructions({ revioGeneralPreferences: 'Be brief.' })).toBeNull()
    expect(codexInstructionArgs({})).toEqual([])
  })

  it('joins the stacked-PR note and the general preferences', () => {
    expect(
      revioAgentInstructions({
        revioLayout: true,
        revioGeneralPreferences: ' Be brief. '
      })
    ).toBe(`${STACKED_PULL_REQUESTS_INSTRUCTION}\n\nBe brief.`)
    expect(
      revioAgentInstructions({
        revioLayout: true,
        revioStackedPullRequests: false,
        revioGeneralPreferences: '  '
      })
    ).toBeNull()
  })

  it('passes Codex the instructions as a quoted config override', () => {
    expect(
      codexInstructionArgs({
        revioLayout: true,
        revioStackedPullRequests: false,
        revioGeneralPreferences: 'Say "hi"\nthen stop.'
      })
    ).toEqual([
      '-c',
      `developer_instructions=${JSON.stringify(`Say "hi"\nthen stop.\n\n${repoActionsGenericInstruction()}`)}`
    ])
  })
})

describe('Repository General preferences', () => {
  it('replaces the global preferences for a repository that has its own, keeping the PR note', () => {
    expect(
      revioRepoAgentInstructions({
        revioLayout: true,
        revioStackedPullRequests: false,
        revioGeneralPreferences: 'Global.',
        revioRepoGeneralPreferences: { r1: ' Repo one. ', r2: '   ' }
      })
    ).toEqual({ r1: 'Repo one.' })
    expect(
      revioRepoAgentInstructions({
        revioLayout: true,
        revioRepoGeneralPreferences: { r1: 'Repo one.' }
      })
    ).toEqual({ r1: `${STACKED_PULL_REQUESTS_INSTRUCTION}\n\nRepo one.` })
  })

  it('adds nothing outside the workspace layout or without repository text', () => {
    expect(revioRepoAgentInstructions({ revioRepoGeneralPreferences: { r1: 'Repo.' } })).toBeNull()
    expect(revioRepoAgentInstructions({ revioLayout: true })).toBeNull()
  })
})
