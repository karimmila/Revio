import type { AgentSessionQuestionAnswer } from '../../../../shared/agent-session/agent-session-question-answer'
import { readRecord, readString } from '../../app-server/codex-item-field-readers'
import { isCodexMcpToolApproval } from './codex-mcp-tool-approval'

export type CodexElicitationMode = 'form' | 'url'

type ScalarType = 'string' | 'number' | 'integer' | 'boolean'

export type CodexElicitationField = {
  name: string
  title: string
  description: string | null
  type: ScalarType | 'array'
  required: boolean
  /** Offered values; for an array field, the items it picks from. */
  choices: { value: string; label: string }[] | null
}

/** The modes Orca shows; a tool-call approval keeps its own Allow/Deny card. */
export function codexElicitationMode(params: unknown): CodexElicitationMode | null {
  if (isCodexMcpToolApproval(params)) {
    return null
  }
  const record = readRecord(params)
  if (record.mode === 'url') {
    return readString(record, 'url') ? 'url' : null
  }
  return record.mode === undefined || record.mode === 'form' ? 'form' : null
}

function readChoices(schema: Record<string, unknown>): CodexElicitationField['choices'] {
  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter((value): value is string => typeof value === 'string')
    const names = Array.isArray(schema.enumNames) ? schema.enumNames : []
    return values.map((value, index) => {
      const name = names.at(index)
      return { value, label: typeof name === 'string' && name.length > 0 ? name : value }
    })
  }
  const options = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : null
  if (!options) {
    return null
  }
  return options.flatMap((option) => {
    const value = readRecord(option).const
    if (typeof value !== 'string') {
      return []
    }
    return [{ value, label: readString(readRecord(option), 'title') ?? value }]
  })
}

function readField(
  name: string,
  schema: Record<string, unknown>,
  required: boolean
): CodexElicitationField | null {
  const base = {
    name,
    title: readString(schema, 'title') ?? name,
    description: readString(schema, 'description'),
    required
  }
  const type = schema.type
  if (type === 'array') {
    const choices = readChoices(readRecord(schema.items))
    return choices && choices.length > 0 ? { ...base, type, choices } : null
  }
  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') {
    const choices = type === 'string' ? readChoices(schema) : null
    if (choices !== null && choices.length === 0) {
      return null
    }
    return { ...base, type, choices }
  }
  return null
}

/** The schema as simple form fields, or null when any property needs the JSON editor instead. */
export function codexElicitationFields(schema: unknown): CodexElicitationField[] | null {
  const record = readRecord(schema)
  const properties = readRecord(record.properties)
  const required = new Set(
    Array.isArray(record.required) ? record.required.filter((key) => typeof key === 'string') : []
  )
  const fields: CodexElicitationField[] = []
  for (const [name, property] of Object.entries(properties)) {
    const field = readField(name, readRecord(property), required.has(name))
    if (!field) {
      return null
    }
    fields.push(field)
  }
  return fields.length > 0 ? fields : null
}

export const CODEX_ELICITATION_JSON_QUESTION_ID = 'structured-json'
export const CODEX_ELICITATION_SKIP_VALUE = ''

export function codexElicitationQuestionId(index: number): string {
  return `field-${index}`
}

export function codexElicitationOptionId(questionId: string, value: string): string {
  return `${questionId}:${encodeURIComponent(value)}`
}

function decodeOptionValue(questionId: string, optionId: string): string | null {
  const prefix = `${questionId}:`
  if (!optionId.startsWith(prefix)) {
    return null
  }
  try {
    return decodeURIComponent(optionId.slice(prefix.length))
  } catch {
    return null
  }
}

type ContentResult = { content: Record<string, unknown> } | { error: string }

function coerce(
  field: CodexElicitationField,
  answer: AgentSessionQuestionAnswer
): { error: string } | { value: unknown } {
  const questionId = answer.questionId
  const picked = answer.optionIds.map((id) => decodeOptionValue(questionId, id))
  if (picked.some((value) => value === null)) {
    return { error: `Unknown option for ${field.name}` }
  }
  const values = picked.filter(
    (value): value is string => value !== null && value !== CODEX_ELICITATION_SKIP_VALUE
  )
  if (field.type === 'array') {
    return { value: values }
  }
  const raw = values.at(0) ?? answer.other?.trim() ?? ''
  if (raw.length === 0) {
    return field.required ? { error: `${field.title} is required.` } : { value: undefined }
  }
  if (field.type === 'boolean') {
    return { value: raw === 'true' }
  }
  if (field.type === 'number' || field.type === 'integer') {
    const value = Number(raw)
    if (!Number.isFinite(value) || (field.type === 'integer' && !Number.isInteger(value))) {
      return {
        error: `${field.title} must be a ${field.type === 'integer' ? 'whole number' : 'number'}.`
      }
    }
    return { value }
  }
  return { value: raw }
}

/** Turns the card's answers into the `content` object the MCP server asked for. */
export function codexElicitationContent(
  schema: unknown,
  answers: readonly AgentSessionQuestionAnswer[]
): ContentResult {
  const fields = codexElicitationFields(schema)
  if (!fields) {
    const text = answers.find(
      (answer) => answer.questionId === CODEX_ELICITATION_JSON_QUESTION_ID
    )?.other
    try {
      const parsed: unknown = JSON.parse(text ?? '')
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { content: readRecord(parsed) }
        : { error: 'Structured response must be a JSON object.' }
    } catch {
      return { error: 'Enter valid JSON.' }
    }
  }
  const content: Record<string, unknown> = {}
  for (const [index, field] of fields.entries()) {
    const answer = answers.find((entry) => entry.questionId === codexElicitationQuestionId(index))
    if (!answer) {
      return { error: `${field.title} is missing.` }
    }
    const result = coerce(field, answer)
    if ('error' in result) {
      return result
    }
    if (result.value !== undefined) {
      content[field.name] = result.value
    }
  }
  return { content }
}
