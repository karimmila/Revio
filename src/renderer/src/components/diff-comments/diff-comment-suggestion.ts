export type DiffCommentBodyPart =
  | { kind: 'text'; offset: number; text: string }
  | { kind: 'suggestion'; offset: number; lines: string[] }

const SUGGESTION_FENCE = /^```suggestion[^\n]*\n([\s\S]*?)^```[ \t]*$/gm

/** Splits a comment body into prose and GitHub ```suggestion blocks ("Suggested change"). */
export function splitDiffCommentSuggestions(body: string): DiffCommentBodyPart[] {
  const parts: DiffCommentBodyPart[] = []
  let last = 0
  for (const match of body.matchAll(SUGGESTION_FENCE)) {
    const start = match.index ?? 0
    const before = body.slice(last, start).trim()
    if (before) {
      parts.push({ kind: 'text', offset: last, text: before })
    }
    const code = match[1].replace(/\n$/, '')
    parts.push({ kind: 'suggestion', offset: start, lines: code === '' ? [] : code.split('\n') })
    last = start + match[0].length
  }
  const rest = body.slice(last).trim()
  if (rest || parts.length === 0) {
    parts.push({ kind: 'text', offset: last, text: parts.length === 0 ? body : rest })
  }
  return parts
}
