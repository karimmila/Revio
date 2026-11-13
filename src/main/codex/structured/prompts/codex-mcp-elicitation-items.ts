import type {
  AgentJournalApprovalItem,
  AgentJournalPromptOption,
  AgentJournalQuestion,
  AgentJournalQuestionItem
} from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { boundJournalPromptText } from '../../../native-chat/agent-session-journal/item-lifecycle/journal-prompt-body-bounds'
import { readRecord, readString } from '../../app-server/codex-item-field-readers'
import {
  CODEX_ELICITATION_JSON_QUESTION_ID,
  CODEX_ELICITATION_SKIP_VALUE,
  codexElicitationFields,
  codexElicitationOptionId,
  codexElicitationQuestionId,
  type CodexElicitationField
} from './codex-mcp-elicitation'

const PENDING = {
  state: 'pending',
  selectedOptionId: null,
  resolvedBy: null,
  resolvedAt: null
} as const

function heading(params: Record<string, unknown>, fallback: string): string {
  return boundJournalPromptText(readString(params, 'message') ?? fallback)
}

function fieldOptions(
  field: CodexElicitationField,
  questionId: string
): AgentJournalPromptOption[] {
  const choices =
    field.type === 'boolean'
      ? [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' }
        ]
      : (field.choices ?? [])
  const options = choices.map((choice) => ({
    id: codexElicitationOptionId(questionId, choice.value),
    label: choice.label
  }))
  // Every grouped question needs an answer, so an optional choice offers an explicit empty one.
  return field.required || options.length === 0 || field.type === 'array'
    ? options
    : [
        ...options,
        {
          id: codexElicitationOptionId(questionId, CODEX_ELICITATION_SKIP_VALUE),
          label: 'Leave empty'
        }
      ]
}

function fieldQuestion(field: CodexElicitationField, index: number): AgentJournalQuestion {
  const id = codexElicitationQuestionId(index)
  const options = fieldOptions(field, id)
  return {
    id,
    header: boundJournalPromptText(field.required ? `${field.title} *` : field.title),
    question: boundJournalPromptText(field.description ?? field.title),
    multiSelect: field.type === 'array',
    options,
    ...(options.length === 0
      ? { freeTextQuestionId: id, freeTextInput: { allowEmpty: !field.required } }
      : {})
  }
}

/** A form elicitation as one grouped question; a schema beyond simple fields asks for JSON. */
export function codexElicitationQuestionItem(params: unknown): AgentJournalQuestionItem {
  const record = readRecord(params)
  const fields = codexElicitationFields(record.requestedSchema)
  const questions: AgentJournalQuestion[] = fields
    ? fields.map(fieldQuestion)
    : [
        {
          id: CODEX_ELICITATION_JSON_QUESTION_ID,
          header: 'Structured response (JSON)',
          question: boundJournalPromptText(JSON.stringify(record.requestedSchema ?? {}, null, 2)),
          multiSelect: false,
          options: [],
          freeTextQuestionId: CODEX_ELICITATION_JSON_QUESTION_ID,
          freeTextInput: { multiline: true, initialValue: '{}' }
        }
      ]
  const server = readString(record, 'serverName')
  return {
    kind: 'question',
    question: heading(
      record,
      server ? `${server} needs more information` : 'More information needed'
    ),
    options: [],
    questions,
    dismissOptions: [
      { id: 'decline', label: 'Decline' },
      { id: 'cancel', label: 'Cancel' }
    ],
    resolution: { ...PENDING }
  }
}

/** A URL elicitation: the user opens the page, then continues or cancels. */
export function codexElicitationUrlItem(params: unknown): AgentJournalApprovalItem {
  const record = readRecord(params)
  const server = readString(record, 'serverName')
  const url = readString(record, 'url')
  return {
    kind: 'approval',
    title: heading(record, server ? `${server} needs authorization` : 'Authorization needed'),
    ...(url ? { authorizationUrl: boundJournalPromptText(url) } : {}),
    detail: null,
    options: [
      { id: 'accept', label: 'Continue' },
      { id: 'cancel', label: 'Cancel' }
    ],
    resolution: { ...PENDING }
  }
}
