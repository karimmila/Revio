import { describe, expect, it } from 'vitest'
import { STACKED_PULL_REQUESTS_INSTRUCTION } from './revio-agent-instructions'
import { revioCodexInstructionArgs } from './revio-codex-instructions'
import { repoActionsGenericInstruction } from './revio-repo-actions-instruction'

const actionsOnly = (): string =>
  `developer_instructions=${JSON.stringify(repoActionsGenericInstruction())}`

describe('revioCodexInstructionArgs', () => {
  const on = { revioLayout: true }

  it('gives Codex the stacked PR instruction as a TOML string override', () => {
    expect(revioCodexInstructionArgs('codex', on)).toEqual([
      '-c',
      `developer_instructions=${JSON.stringify(`${STACKED_PULL_REQUESTS_INSTRUCTION}\n\n${repoActionsGenericInstruction()}`)}`
    ])
  })

  it('adds nothing for other agents or outside the layout, and only the actions note with the setting off', () => {
    expect(revioCodexInstructionArgs('claude', on)).toEqual([])
    expect(revioCodexInstructionArgs('codex', {})).toEqual([])
    expect(revioCodexInstructionArgs('codex', { ...on, revioStackedPullRequests: false })).toEqual([
      '-c',
      actionsOnly()
    ])
  })
})

it('adds the chosen Codex personality after the instructions', () => {
  const args = revioCodexInstructionArgs('codex', {
    revioLayout: true,
    revioStackedPullRequests: false,
    revioCodexPersonality: 'none'
  })
  expect(args).toEqual(['-c', actionsOnly(), '-c', 'personality="none"'])
})
