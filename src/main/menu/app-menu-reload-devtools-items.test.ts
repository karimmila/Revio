import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted((): { nativeClick: ReturnType<typeof vi.fn>; focused: unknown } => ({
  nativeClick: vi.fn(),
  focused: null
}))

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null },
  MenuItem: class {
    accelerator = 'Alt+CommandOrControl+I'
    click = electron.nativeClick
  },
  webContents: { getFocusedWebContents: () => electron.focused }
}))
vi.mock('../i18n/main-i18n', () => ({ translateMain: (_key: string, text: string) => text }))

const { createAppMenuReloadAndDevToolsItems } = await import('./app-menu-reload-devtools-items')

function clickDevTools(options: Parameters<typeof createAppMenuReloadAndDevToolsItems>[0]): void {
  const item = createAppMenuReloadAndDevToolsItems(options)[2]
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the click handler under test reads neither the menu item nor the event
  item?.click?.({} as never, undefined, {} as never)
}

describe('View > Toggle Developer Tools', () => {
  beforeEach(() => {
    electron.nativeClick.mockClear()
    electron.focused = null
  })

  it('does nothing for the app window while debug tools are not allowed', () => {
    clickDevTools({ forceReloadShortcutLabel: '', appDevToolsAllowed: () => false })
    expect(electron.nativeClick).not.toHaveBeenCalled()
  })

  it('opens them once allowed', () => {
    clickDevTools({ forceReloadShortcutLabel: '', appDevToolsAllowed: () => true })
    expect(electron.nativeClick).toHaveBeenCalledTimes(1)
  })

  it('still opens a browser page’s own DevTools', () => {
    electron.focused = {}
    const toggleFocusedPageDevTools = vi.fn(() => true)
    clickDevTools({
      forceReloadShortcutLabel: '',
      appDevToolsAllowed: () => false,
      toggleFocusedPageDevTools
    })
    expect(toggleFocusedPageDevTools).toHaveBeenCalledTimes(1)
    expect(electron.nativeClick).not.toHaveBeenCalled()
  })
})
