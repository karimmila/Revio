export type JsonPreview =
  | { kind: 'value'; value: unknown }
  | { kind: 'lines'; records: { line: number; value?: unknown; error?: string }[] }
  | { kind: 'error'; message: string }

const MAX_JSONL_RECORDS = 2000

/** Parses a .json document, or each non-empty line of a .jsonl one, for the JSON preview. */
export function parseJsonPreview(content: string, jsonl: boolean): JsonPreview {
  if (!jsonl) {
    try {
      return { kind: 'value', value: JSON.parse(content) }
    } catch (error) {
      return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }
  const records: { line: number; value?: unknown; error?: string }[] = []
  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length && records.length < MAX_JSONL_RECORDS; index += 1) {
    const text = lines[index].trim()
    if (text === '') {
      continue
    }
    try {
      records.push({ line: index + 1, value: JSON.parse(text) })
    } catch (error) {
      records.push({
        line: index + 1,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return { kind: 'lines', records }
}

/** One-line summary of a collapsed object or array, e.g. `{3}` or `[12]`. */
export function jsonSummary(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.length}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).length}}`
  }
  return JSON.stringify(value) ?? String(value)
}
