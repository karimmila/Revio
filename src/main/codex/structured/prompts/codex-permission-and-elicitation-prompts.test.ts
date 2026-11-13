import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session/agent-session-question-answer'
import { applyCodexPromptAnswer, prepareCodexPromptAnswer } from './codex-structured-prompt-replies'
import { CodexPromptRegistry, type CodexPendingPrompt } from './codex-prompt-registry'
import { codexApprovalItem } from './codex-structured-prompt-items'
import { codexElicitationQuestionItem } from './codex-mcp-elicitation-items'
import { disposeCodexServerRequest } from './codex-server-request-disposition'

const TURN = { threadId: 'thread-1', turnId: 'turn-1' }
const PERMISSIONS = {
  network: { enabled: true },
  fileSystem: { read: ['/repo/docs'], write: ['/repo/out'] }
}

function permissionsRequest(params: Record<string, unknown> = {}) {
  return {
    id: 21,
    method: 'item/permissions/requestApproval',
    params: { ...TURN, itemId: 'item-1', reason: 'Fetch docs', permissions: PERMISSIONS, ...params }
  }
}

function elicitation(params: Record<string, unknown>) {
  return {
    id: 31,
    method: 'mcpServer/elicitation/request',
    params: { ...TURN, serverName: 'linear', message: 'Pick a team', ...params }
  }
}

function registered(prompt: CodexPendingPrompt | null): CodexPendingPrompt {
  if (!prompt) {
    throw new Error('expected the request to register')
  }
  return prompt
}

function reply(prompt: CodexPendingPrompt, response: AgentSessionPromptResponse) {
  return applyCodexPromptAnswer(prompt, prepareCodexPromptAnswer(prompt, response))
}

const FORM_SCHEMA = {
  type: 'object',
  required: ['team'],
  properties: {
    team: { type: 'string', enum: ['eng', 'ops'], enumNames: ['Engineering', 'Operations'] },
    count: { type: 'integer', title: 'Count' },
    notify: { type: 'boolean' }
  }
}

describe('Codex permission requests', () => {
  it('journals the requested access and grants exactly it for the turn', () => {
    const request = permissionsRequest()
    const prompt = registered(new CodexPromptRegistry().register(request))
    expect(
      codexApprovalItem({ method: request.method, params: request.params, detail: null })
    ).toMatchObject({
      title: 'Codex requests permission',
      decisionReason: 'Fetch docs',
      detail: 'Network access\nRead /repo/docs\nWrite /repo/out',
      options: [
        { id: 'accept', label: 'Approve' },
        { id: 'decline', label: 'Deny' }
      ]
    })
    expect(reply(prompt, { kind: 'option', optionId: 'accept' })).toEqual({
      permissions: PERMISSIONS,
      scope: 'turn'
    })
  })

  it('grants nothing on Deny and refuses decisions it did not offer', () => {
    const prompt = registered(new CodexPromptRegistry().register(permissionsRequest()))
    expect(reply(prompt, { kind: 'option', optionId: 'decline' })).toEqual({
      permissions: {},
      scope: 'turn',
      strictAutoReview: true
    })
    expect(() => prepareCodexPromptAnswer(prompt, { kind: 'option', optionId: 'cancel' })).toThrow()
  })

  it('keeps the automatic decline for a request without a turn', () => {
    const connection = { respond: vi.fn(), respondWithError: vi.fn() }
    const request = permissionsRequest({ turnId: undefined })
    expect(disposeCodexServerRequest(new CodexPromptRegistry(), connection, request).kind).toBe(
      'responded'
    )
    expect(connection.respond).toHaveBeenCalledWith(21, {
      permissions: {},
      scope: 'turn',
      strictAutoReview: true
    })
  })
})

describe('Codex MCP elicitations', () => {
  it('turns a form into one grouped question and replies with typed content', () => {
    const request = elicitation({ mode: 'form', requestedSchema: FORM_SCHEMA })
    const registry = new CodexPromptRegistry()
    const prompt = registered(registry.register(request))
    const item = codexElicitationQuestionItem(request.params)
    expect(item.question).toBe('Pick a team')
    expect(item.questions?.map((question) => question.header)).toEqual([
      'team *',
      'Count',
      'notify'
    ])
    expect(item.questions?.at(0)?.options.map((option) => option.label)).toEqual([
      'Engineering',
      'Operations'
    ])
    registry.bindJournalItemId('journal-1', 'thread-1', prompt.promptKey)
    expect(registry.claim('journal-1', 'question')).not.toBeNull()

    expect(
      reply(prompt, {
        kind: 'answers',
        answers: [
          { questionId: 'field-0', optionIds: ['field-0:ops'] },
          { questionId: 'field-1', optionIds: [], other: '3' },
          { questionId: 'field-2', optionIds: ['field-2:'] }
        ]
      })
    ).toEqual({ action: 'accept', content: { team: 'ops', count: 3 }, _meta: null })
  })

  it('offers Decline and Cancel on a form, each its own MCP action without content', () => {
    const request = elicitation({ mode: 'form', requestedSchema: FORM_SCHEMA })
    expect(codexElicitationQuestionItem(request.params).dismissOptions).toEqual([
      { id: 'decline', label: 'Decline' },
      { id: 'cancel', label: 'Cancel' }
    ])
    const prompt = registered(new CodexPromptRegistry().register(request))
    expect(reply(prompt, { kind: 'option', optionId: 'decline' })).toEqual({
      action: 'decline',
      content: null,
      _meta: null
    })
    expect(reply(prompt, { kind: 'option', optionId: 'cancel' })).toEqual({
      action: 'cancel',
      content: null,
      _meta: null
    })
    expect(() => prepareCodexPromptAnswer(prompt, { kind: 'option', optionId: 'accept' })).toThrow()
  })

  it('rejects a value the schema does not allow', () => {
    const prompt = registered(
      new CodexPromptRegistry().register(elicitation({ requestedSchema: FORM_SCHEMA }))
    )
    expect(() =>
      prepareCodexPromptAnswer(prompt, {
        kind: 'answers',
        answers: [
          { questionId: 'field-0', optionIds: ['field-0:eng'] },
          { questionId: 'field-1', optionIds: [], other: '2.5' },
          { questionId: 'field-2', optionIds: ['field-2:true'] }
        ]
      })
    ).toThrow('Count must be a whole number.')
  })

  it('asks for a JSON object when the schema has nested fields', () => {
    const schema = { type: 'object', properties: { filter: { type: 'object' } } }
    const request = elicitation({ requestedSchema: schema })
    const prompt = registered(new CodexPromptRegistry().register(request))
    expect(codexElicitationQuestionItem(request.params).questions?.at(0)).toMatchObject({
      header: 'Structured response (JSON)',
      freeTextInput: { multiline: true }
    })
    const json = (other: string): AgentSessionPromptResponse => ({
      kind: 'answers',
      answers: [{ questionId: 'structured-json', optionIds: [], other }]
    })
    expect(reply(prompt, json('{"filter":{"a":1}}'))).toEqual({
      action: 'accept',
      content: { filter: { a: 1 } },
      _meta: null
    })
    expect(() => prepareCodexPromptAnswer(prompt, json('[1]'))).toThrow(
      'Structured response must be a JSON object.'
    )
    expect(() => prepareCodexPromptAnswer(prompt, json('{'))).toThrow('Enter valid JSON.')
  })

  it('shows a URL elicitation as an approval with its authorization page', () => {
    const request = elicitation({
      mode: 'url',
      url: 'https://example.com/auth',
      elicitationId: 'e-1'
    })
    const prompt = registered(new CodexPromptRegistry().register(request))
    expect(
      codexApprovalItem({ method: request.method, params: request.params, detail: null })
    ).toMatchObject({
      title: 'Pick a team',
      authorizationUrl: 'https://example.com/auth',
      options: [
        { id: 'accept', label: 'Continue' },
        { id: 'cancel', label: 'Cancel' }
      ]
    })
    expect(reply(prompt, { kind: 'option', optionId: 'accept' })).toEqual({
      action: 'accept',
      content: null,
      _meta: null
    })
    expect(reply(prompt, { kind: 'option', optionId: 'cancel' })).toEqual({
      action: 'cancel',
      content: null,
      _meta: null
    })
  })

  it('still declines an elicitation without a turn', () => {
    const connection = { respond: vi.fn(), respondWithError: vi.fn() }
    const request = elicitation({ turnId: undefined, requestedSchema: FORM_SCHEMA })
    disposeCodexServerRequest(new CodexPromptRegistry(), connection, request)
    expect(connection.respond).toHaveBeenCalledWith(31, {
      action: 'decline',
      content: null,
      _meta: null
    })
  })
})
