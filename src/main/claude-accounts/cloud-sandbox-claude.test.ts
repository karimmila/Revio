import { describe, expect, it } from 'vitest'
import { CLAUDE_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-claude-placeholder'
import { isOrcaCloudSandboxHost } from './cloud-sandbox-claude'
import { withBrokeredCloudClaude } from '../claude/structured/launch/claude-structured-child-env'

describe('isOrcaCloudSandboxHost', () => {
  it('recognises an Orca cloud sandbox by its brokered Claude placeholder only', () => {
    expect(isOrcaCloudSandboxHost({ CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_PLACEHOLDER_TOKEN })).toBe(true)
    expect(isOrcaCloudSandboxHost({ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-real' })).toBe(false)
    expect(isOrcaCloudSandboxHost({})).toBe(false)
  })
})

describe('withBrokeredCloudClaude', () => {
  it('drops a project API key from Claude chats in a cloud sandbox only', () => {
    const sandbox = {
      CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_PLACEHOLDER_TOKEN,
      ANTHROPIC_API_KEY: 'sk-ant-api03-project',
      ANTHROPIC_AUTH_TOKEN: 'x',
      PATH: '/usr/bin'
    }
    expect(withBrokeredCloudClaude(sandbox)).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_PLACEHOLDER_TOKEN,
      PATH: '/usr/bin'
    })
    const mac = { ANTHROPIC_API_KEY: 'sk-ant-api03-own', PATH: '/usr/bin' }
    expect(withBrokeredCloudClaude(mac)).toBe(mac)
  })
})
