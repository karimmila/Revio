/** A compaction summary kept on its row stays under this, so one row cannot crowd the journal. */
export const AGENT_JOURNAL_COMPACT_SUMMARY_MAX_CHARS = 32_000

/** The text of Claude's compact-summary user frame (`isCompactSummary`), bounded; null otherwise. */
export function claudeCompactSummaryText(frame: Record<string, unknown>): string | null {
  if (frame.type !== 'user' || frame.isCompactSummary !== true) {
    return null
  }
  const message = frame.message
  const content =
    typeof message === 'object' && message !== null && 'content' in message
      ? message.content
      : undefined
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .flatMap((part: unknown) =>
              typeof part === 'object' &&
              part !== null &&
              'type' in part &&
              part.type === 'text' &&
              'text' in part &&
              typeof part.text === 'string'
                ? [part.text]
                : []
            )
            .join('\n')
        : ''
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, AGENT_JOURNAL_COMPACT_SUMMARY_MAX_CHARS) : null
}
