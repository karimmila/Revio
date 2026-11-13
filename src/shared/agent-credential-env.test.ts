import { describe, expect, it } from 'vitest'
import { agentCredentialEnv } from './agent-credential-env'

const credentials = { anthropicApiKey: 'ak', anthropicAuthToken: 'tok', openaiApiKey: 'ok' }

describe('agentCredentialEnv', () => {
  it('gives Claude the secret its provider needs', () => {
    expect(agentCredentialEnv('claude', { revioClaudeAuth: 'apiKey' }, credentials)).toEqual({
      ANTHROPIC_API_KEY: 'ak'
    })
    expect(agentCredentialEnv('claude', { revioClaudeAuth: 'custom' }, credentials)).toEqual({
      ANTHROPIC_AUTH_TOKEN: 'tok'
    })
    expect(agentCredentialEnv('claude', {}, credentials)).toEqual({})
  })

  it('gives Codex its OpenAI key only in API key mode', () => {
    expect(agentCredentialEnv('codex', { revioCodexAuth: 'apiKey' }, credentials)).toEqual({
      OPENAI_API_KEY: 'ok',
      CODEX_API_KEY: 'ok'
    })
    expect(agentCredentialEnv('codex', {}, credentials)).toEqual({})
    expect(agentCredentialEnv('codex', { revioCodexAuth: 'apiKey' }, {})).toEqual({})
  })
})
