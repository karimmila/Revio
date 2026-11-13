import { describe, expect, it } from 'vitest'
import { getSmartWorkspaceNameModes } from './smart-workspace-localized-options'
import {
  activeCreateFromTabKey,
  revioCreateFromTabs,
  steppedCreateFromTab
} from './revio-create-from-tabs'

const modes = getSmartWorkspaceNameModes().filter((mode) =>
  ['smart', 'github', 'branches', 'text'].includes(mode.id)
)

describe('revioCreateFromTabs', () => {
  it('splits GitHub into Pull requests and Issues around Branches', () => {
    expect(revioCreateFromTabs(modes).map((tab) => tab.label)).toEqual([
      'Smart',
      'Pull requests',
      'Branches',
      'Issues',
      'Name'
    ])
  })

  it('keeps Linear and leaves out GitLab and Jira', () => {
    const keys = revioCreateFromTabs(getSmartWorkspaceNameModes()).map((tab) => tab.key)
    expect(keys).toEqual(['smart', 'github:pr', 'branches', 'github:issue', 'linear', 'text'])
  })

  it('drops both GitHub tabs when GitHub is not a source', () => {
    const keys = revioCreateFromTabs(modes.filter((mode) => mode.id !== 'github')).map(
      (tab) => tab.key
    )
    expect(keys).toEqual(['smart', 'branches', 'text'])
  })

  it('wraps Tab and Shift+Tab at the ends', () => {
    const tabs = revioCreateFromTabs(modes)
    expect(steppedCreateFromTab(tabs, 'text', 1)?.key).toBe('smart')
    expect(steppedCreateFromTab(tabs, 'smart', -1)?.key).toBe('text')
    expect(steppedCreateFromTab(tabs, 'github:pr', 1)?.key).toBe('branches')
  })

  it('shows the GitHub mode as Pull requests until Issues is picked', () => {
    expect(activeCreateFromTabKey('github', null)).toBe('github:pr')
    expect(activeCreateFromTabKey('github', 'issue')).toBe('github:issue')
    expect(activeCreateFromTabKey('branches', 'issue')).toBe('branches')
  })
})
