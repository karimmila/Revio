import { expect, it } from 'vitest'
import { filterSnippets, saveSnippet, snippetKeyword } from './revio-prompt-snippets'

const a = { id: 'a', name: 'Write tests', keyword: 'tests', body: 'Add unit tests' }
const b = { id: 'b', name: 'Bug report', keyword: 'bug', body: 'Reproduce, then write tests' }

it('cleans keywords', () => {
  expect(snippetKeyword(' my key;word ')).toBe('mykeyword')
})

it('ranks keyword over name over body; empty lists by name', () => {
  expect(filterSnippets([a, b], '').map((s) => s.id)).toEqual(['b', 'a'])
  expect(filterSnippets([a, b], ';bu').map((s) => s.id)).toEqual(['b'])
  expect(filterSnippets([a, b], 'tests').map((s) => s.id)).toEqual(['a', 'b'])
  expect(filterSnippets([a, b], 'zzz')).toEqual([])
})

it('saves by id and keeps keywords unique', () => {
  expect(saveSnippet([a], b)).toEqual([a, b])
  expect(saveSnippet([a, b], { ...a, name: 'Tests' })).toEqual([{ ...a, name: 'Tests' }, b])
  expect(saveSnippet([a, b], { ...b, keyword: 'tests' })).toBe('keyword-taken')
})
