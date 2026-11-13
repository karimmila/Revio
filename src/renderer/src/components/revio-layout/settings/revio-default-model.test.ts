import { describe, expect, it } from 'vitest'
import { revioChatAgent, decodeDefaultModel, encodeDefaultModel } from './revio-default-model'

const AGENTS = ['claude', 'codex', 'cursor'] as const

describe('Default model', () => {
  it('round-trips an agent and a model id that holds colons', () => {
    const value = encodeDefaultModel({ agent: 'codex', modelId: 'gpt-5:high' })
    expect(decodeDefaultModel(value, AGENTS)).toEqual({ agent: 'codex', modelId: 'gpt-5:high' })
  })

  it('rejects unknown agents and empty parts', () => {
    expect(decodeDefaultModel('gemini::pro', AGENTS)).toBeNull()
    expect(decodeDefaultModel('claude::', AGENTS)).toBeNull()
    expect(decodeDefaultModel('opus', AGENTS)).toBeNull()
  })

  it('falls back to Claude for blank, unset or unlisted agents', () => {
    expect(revioChatAgent(null, AGENTS)).toBe('claude')
    expect(revioChatAgent('blank', AGENTS)).toBe('claude')
    expect(revioChatAgent('aider', AGENTS)).toBe('claude')
    expect(revioChatAgent('codex', AGENTS)).toBe('codex')
  })
})
