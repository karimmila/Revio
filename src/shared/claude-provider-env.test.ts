import { describe, expect, it } from 'vitest'
import {
  claudeProviderFromEnv,
  claudeProviderFromSettings,
  claudeProviderUpdate,
  withClaudeProvider
} from './claude-provider-env'

describe('Claude provider env', () => {
  it('reads the provider from the launch env', () => {
    expect(claudeProviderFromEnv(undefined)).toBe('subscription')
    expect(claudeProviderFromEnv({ CLAUDE_CODE_USE_BEDROCK: '1' })).toBe('bedrock')
    expect(claudeProviderFromEnv({ CLAUDE_CODE_USE_VERTEX: 'true' })).toBe('vertex')
    expect(claudeProviderFromEnv({ CLAUDE_CODE_USE_BEDROCK: '0' })).toBe('subscription')
  })

  it('sets one provider flag and keeps other variables', () => {
    expect(withClaudeProvider({ CLAUDE_CODE_USE_BEDROCK: '1', FOO: 'x' }, 'vertex')).toEqual({
      CLAUDE_CODE_USE_VERTEX: '1',
      FOO: 'x'
    })
    expect(withClaudeProvider({ CLAUDE_CODE_USE_VERTEX: '1' }, 'subscription')).toEqual({})
  })
})

describe('Claude provider settings', () => {
  it('prefers the env flag, then the stored-secret auth mode', () => {
    expect(claudeProviderFromSettings({ revioClaudeAuth: 'apiKey' })).toBe('apiKey')
    expect(
      claudeProviderFromSettings({
        revioClaudeAuth: 'apiKey',
        agentDefaultEnv: { claude: { CLAUDE_CODE_USE_BEDROCK: '1' } }
      })
    ).toBe('bedrock')
  })

  it('writes the flag and the auth mode together', () => {
    expect(claudeProviderUpdate({}, 'custom')).toEqual({
      agentDefaultEnv: { claude: {} },
      revioClaudeAuth: 'custom'
    })
    expect(claudeProviderUpdate({}, 'vertex').revioClaudeAuth).toBeUndefined()
  })
})
