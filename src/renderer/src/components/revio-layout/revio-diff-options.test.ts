import { afterEach, describe, expect, it, vi } from 'vitest'
import { revioDiffEditorOptions, revioDiffSideBySide } from './revio-diff-options'
import {
  revioDiffEditMode,
  revioDiffShowsEntireFile,
  setRevioDiffEditMode,
  setRevioDiffEntireFile
} from './revio-diff-view-store'

function setLayout(on: boolean): void {
  vi.stubGlobal('document', { documentElement: { dataset: { revioLayout: String(on) } } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setRevioDiffEntireFile(false)
  setRevioDiffEditMode(false)
})

describe('revioDiffEditorOptions', () => {
  it('folds unchanged runs by default in the workspace layout', () => {
    setLayout(true)
    expect(revioDiffEditorOptions().hideUnchangedRegions?.enabled).toBe(true)
  })

  it('shows the entire file when Entire file is on', () => {
    setLayout(true)
    expect(revioDiffEditorOptions(true).hideUnchangedRegions?.enabled).toBe(false)
  })

  it('adds nothing outside the layout', () => {
    setLayout(false)
    expect(revioDiffEditorOptions(true)).toEqual({})
  })
})

describe('Diff view store', () => {
  it('starts folded and toggles Entire file', () => {
    expect(revioDiffShowsEntireFile()).toBe(false)
    setRevioDiffEntireFile(true)
    expect(revioDiffShowsEntireFile()).toBe(true)
  })
})

describe('File edit mode', () => {
  it('starts read-only and toggles', () => {
    expect(revioDiffEditMode()).toBe(false)
    setRevioDiffEditMode(true)
    expect(revioDiffEditMode()).toBe(true)
  })
})

describe('revioDiffSideBySide', () => {
  it('shows an added or a deleted file inline, whatever the view is set to', () => {
    setLayout(true)
    expect(revioDiffSideBySide(true, '', 'new file\n')).toBe(false)
    expect(revioDiffSideBySide(true, 'old file\n', '')).toBe(false)
    expect(revioDiffSideBySide(true, 'before\n', 'after\n')).toBe(true)
    expect(revioDiffSideBySide(false, 'before\n', 'after\n')).toBe(false)
  })

  it('leaves the classic layout as it is', () => {
    setLayout(false)
    expect(revioDiffSideBySide(true, '', 'new file\n')).toBe(true)
  })
})
