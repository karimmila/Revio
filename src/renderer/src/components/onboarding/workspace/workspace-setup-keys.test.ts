import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceSetupKeyIntent } from './workspace-setup-keys'

const idle = { editable: false, activatable: false, popupOpen: false }

beforeEach(() => {
  vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
})

describe('workspaceSetupKeyIntent', () => {
  it('continues on Enter and Cmd+Enter', () => {
    expect(workspaceSetupKeyIntent({ key: 'Enter' }, idle)).toBe('continue')
    expect(workspaceSetupKeyIntent({ key: 'Enter', metaKey: true }, idle)).toBe('continue')
  })

  it('maps Escape to Set up later', () => {
    expect(workspaceSetupKeyIntent({ key: 'Escape' }, idle)).toBe('later')
  })

  it('closes a setup reopened from Help on Escape, and leaves Enter alone', () => {
    const reopened = { reopened: true }
    expect(workspaceSetupKeyIntent({ key: 'Escape' }, idle, reopened)).toBe('close')
    expect(workspaceSetupKeyIntent({ key: 'Enter' }, idle, reopened)).toBe('continue')
    expect(
      workspaceSetupKeyIntent({ key: 'Escape' }, { ...idle, popupOpen: true }, reopened)
    ).toBeNull()
  })

  it('lets a focused button take its own Enter, but Cmd+Enter still continues', () => {
    const onButton = { ...idle, activatable: true }
    expect(workspaceSetupKeyIntent({ key: 'Enter' }, onButton)).toBeNull()
    expect(workspaceSetupKeyIntent({ key: 'Enter', metaKey: true }, onButton)).toBe('continue')
  })

  it('never continues from a text field, so a pasted token is not lost', () => {
    const inField = { ...idle, editable: true }
    expect(workspaceSetupKeyIntent({ key: 'Enter' }, inField)).toBeNull()
    expect(workspaceSetupKeyIntent({ key: 'Enter', metaKey: true }, inField)).toBeNull()
    expect(workspaceSetupKeyIntent({ key: 'Escape' }, inField)).toBe('later')
  })

  it('leaves Escape to an open menu and ignores IME composition', () => {
    expect(workspaceSetupKeyIntent({ key: 'Escape' }, { ...idle, popupOpen: true })).toBeNull()
    expect(workspaceSetupKeyIntent({ key: 'Enter', isComposing: true }, idle)).toBeNull()
  })
})
