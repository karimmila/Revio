import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n/main-i18n', () => ({ translateMain: (_key: string, text: string) => text }))
vi.mock('../../shared/fork-services', () => ({ isForkServiceEnabled: () => false }))

const { createAppearanceSubmenu, getNextDefaultOnAppearanceSettingValue } =
  await import('./app-menu-appearance')

function labels(revioLayout: boolean): string[] {
  const menu = createAppearanceSubmenu({
    appearance: {
      showTasksButton: true,
      showAutomationsButton: true,
      showMobileButton: true,
      showTitlebarAppName: true,
      statusBarVisible: true,
      revioLayout
    },
    shortcutLabel: () => '',
    onToggleLeftSidebar: vi.fn(),
    onToggleRightSidebar: vi.fn(),
    onToggleAppearance: vi.fn()
  })
  const items = Array.isArray(menu.submenu) ? menu.submenu : []
  return items.flatMap((item) => (item.label ? [item.label] : []))
}

describe('Appearance submenu', () => {
  it('keeps the Tasks and Automations button toggles in the classic layout', () => {
    expect(labels(false)).toEqual(
      expect.arrayContaining(['Show Tasks Button', 'Show Automations Button'])
    )
  })

  it('drops the Tasks and Automations button toggles in the Revio layout', () => {
    const revio = labels(true)
    expect(revio).not.toContain('Show Tasks Button')
    expect(revio).not.toContain('Show Automations Button')
    expect(revio).toContain('Show Titlebar App Name')
  })

  it('offers Show Status Bar only in the classic layout', () => {
    expect(labels(false)).toContain('Show Status Bar')
    // The Revio layout has no status bar, so nothing in its menu can bring one back.
    expect(labels(true)).not.toContain('Show Status Bar')
  })

  it('toggles default-on settings from visible to hidden', () => {
    expect(getNextDefaultOnAppearanceSettingValue(undefined)).toBe(false)
    expect(getNextDefaultOnAppearanceSettingValue(false)).toBe(true)
  })
})
