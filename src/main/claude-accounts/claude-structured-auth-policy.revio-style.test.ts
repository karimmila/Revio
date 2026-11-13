import { expect, it } from 'vitest'
import { claudeSettingsExtraArgs } from './claude-structured-auth-policy'

it('passes the output style as --settings', () => {
  expect(claudeSettingsExtraArgs({ settingsJson: '{"outputStyle":"Learning"}' })).toEqual({
    settings: '{"outputStyle":"Learning"}'
  })
  expect(claudeSettingsExtraArgs({})).toEqual({})
})

it("gives a workspace's /add-dir folders to its Claude launches", async () => {
  const { claudeLinkedDirectories } = await import('./claude-structured-auth-policy')
  expect(claudeLinkedDirectories({ linkedDirectories: { '/w': ['/docs'] } }, '/w')).toEqual([
    '/docs'
  ])
  expect(claudeLinkedDirectories({}, '/w')).toEqual([])
})

it("appends a repository's own General preferences to its Claude chats, else the global ones", async () => {
  const { claudeSystemPromptOptions } = await import('./claude-structured-auth-policy')
  const policy = { systemPromptAppend: 'Global.', systemPromptAppendByRepo: { r1: 'Repo.' } }
  expect(claudeSystemPromptOptions(policy, 'r1').systemPrompt?.append).toBe('Repo.')
  expect(claudeSystemPromptOptions(policy, 'r2').systemPrompt?.append).toBe('Global.')
  expect(claudeSystemPromptOptions({ systemPromptAppendByRepo: { r1: 'Repo.' } }, 'r2')).toEqual({})
})
