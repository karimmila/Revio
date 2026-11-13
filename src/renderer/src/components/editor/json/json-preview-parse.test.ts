import { describe, expect, it } from 'vitest'
import { jsonSummary, parseJsonPreview } from './json-preview-parse'

describe('parseJsonPreview', () => {
  it('parses a JSON document', () => {
    expect(parseJsonPreview('{"a":[1,2]}', false)).toEqual({ kind: 'value', value: { a: [1, 2] } })
  })

  it('reports invalid JSON', () => {
    expect(parseJsonPreview('{', false).kind).toBe('error')
  })

  it('parses JSONL line by line and keeps bad lines', () => {
    const preview = parseJsonPreview('{"a":1}\n\nnope\n[2]\n', true)
    expect(preview.kind).toBe('lines')
    if (preview.kind !== 'lines') {
      return
    }
    expect(preview.records.map((r) => [r.line, r.value, r.error !== undefined])).toEqual([
      [1, { a: 1 }, false],
      [3, undefined, true],
      [4, [2], false]
    ])
  })

  it('summarizes collapsed values', () => {
    expect(jsonSummary([1, 2, 3])).toBe('[3]')
    expect(jsonSummary({ a: 1, b: 2 })).toBe('{2}')
    expect(jsonSummary('x')).toBe('"x"')
  })
})
