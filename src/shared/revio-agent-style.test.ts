import { expect, it } from 'vitest'
import { claudeOutputStyleSettings, codexPersonalityArgs } from './revio-agent-style'

it('passes the Codex personality as a config override', () => {
  expect(codexPersonalityArgs({ revioLayout: true })).toEqual([])
  expect(codexPersonalityArgs({ revioLayout: true, revioCodexPersonality: 'friendly' })).toEqual([
    '-c',
    'personality="friendly"'
  ])
  expect(codexPersonalityArgs({ revioLayout: false, revioCodexPersonality: 'friendly' })).toEqual(
    []
  )
})

it('names the Claude output style in --settings, none for Default', () => {
  expect(claudeOutputStyleSettings({ revioLayout: true, revioClaudeOutputStyle: 'learning' })).toBe(
    '{"outputStyle":"Learning"}'
  )
  expect(
    claudeOutputStyleSettings({ revioLayout: true, revioClaudeOutputStyle: 'default' })
  ).toBeNull()
})
