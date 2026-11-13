import { expect, it } from 'vitest'
import { snippetForTypedKeyword } from './revio-snippet-keyword'

const snippets = [{ id: 'a', name: 'Tests', keyword: 'tests', body: 'Add unit tests.' }]

it('finds a snippet from the ;keyword before the caret', () => {
  expect(snippetForTypedKeyword('please ;tests', snippets)).toEqual({
    snippet: snippets[0],
    typedLength: 6
  })
  expect(snippetForTypedKeyword(';tests', snippets)?.typedLength).toBe(6)
  expect(snippetForTypedKeyword('a;tests', snippets)).toBeNull()
  expect(snippetForTypedKeyword('please ;nope', snippets)).toBeNull()
})
