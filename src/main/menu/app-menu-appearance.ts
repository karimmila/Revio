import { translateMain } from '../i18n/main-i18n'
import { isForkServiceEnabled } from '../../shared/fork-services'

export type AppearanceMenuState = {
  showTasksButton: boolean
  showAutomationsButton: boolean
  showMobileButton: boolean
  showTitlebarAppName: boolean
  statusBarVisible: boolean
  revioLayout: boolean
}

export type AppearanceMenuKey = Exclude<keyof AppearanceMenuState, 'revioLayout'>

export function getNextDefaultOnAppearanceSettingValue(current: boolean | undefined): boolean {
  return !(current !== false)
}

export type AppearanceSubmenuOptions = {
  appearance: AppearanceMenuState
  shortcutLabel: (actionId: 'sidebar.left.toggle' | 'sidebar.right.toggle') => string
  onToggleLeftSidebar: () => void
  onToggleRightSidebar: () => void
  onToggleAppearance: (key: AppearanceMenuKey) => void
}

// Electron menus are not reactive; callers rebuild after appearance settings change.
export function createAppearanceSubmenu({
  appearance,
  shortcutLabel,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onToggleAppearance
}: AppearanceSubmenuOptions): Electron.MenuItemConstructorOptions {
  // The Revio layout has no Tasks or Automations titlebar buttons, so these toggles would do nothing.
  const titlebarButtonItems: Electron.MenuItemConstructorOptions[] = appearance.revioLayout
    ? []
    : [
        {
          label: translateMain('menu.showTasksButton', 'Show Tasks Button'),
          type: 'checkbox',
          checked: appearance.showTasksButton,
          click: () => onToggleAppearance('showTasksButton')
        },
        {
          label: translateMain('menu.showAutomationsButton', 'Show Automations Button'),
          type: 'checkbox',
          checked: appearance.showAutomationsButton,
          click: () => onToggleAppearance('showAutomationsButton')
        }
      ]
  return {
    label: translateMain('menu.appearance', 'Appearance'),
    submenu: [
      {
        // Display hints only: native accelerators bypass markdown bold handling and renderer-owned sidebar state.
        label: `${translateMain('menu.toggleLeftSidebar', 'Toggle Left Sidebar')}\t${shortcutLabel('sidebar.left.toggle')}`,
        click: () => onToggleLeftSidebar()
      },
      {
        label: `${translateMain('menu.toggleRightSidebar', 'Toggle Right Sidebar')}\t${shortcutLabel('sidebar.right.toggle')}`,
        click: () => onToggleRightSidebar()
      },
      // The Revio layout has no status bar (its usage, rate-limit and keep-awake controls are
      // upstream's), so the item that would bring it back is not offered there.
      ...(appearance.revioLayout
        ? []
        : [
            {
              label: translateMain('menu.showStatusBar', 'Show Status Bar'),
              type: 'checkbox' as const,
              checked: appearance.statusBarVisible,
              click: () => onToggleAppearance('statusBarVisible')
            }
          ]),
      { type: 'separator' },
      ...titlebarButtonItems,
      ...(isForkServiceEnabled('relayBaseUrl')
        ? [
            {
              label: translateMain('menu.showMobileButton', 'Show {{productName}} Mobile Button'),
              type: 'checkbox' as const,
              checked: appearance.showMobileButton,
              click: () => onToggleAppearance('showMobileButton')
            }
          ]
        : []),
      {
        label: translateMain('menu.showTitlebarAppName', 'Show Titlebar App Name'),
        type: 'checkbox',
        checked: appearance.showTitlebarAppName,
        click: () => onToggleAppearance('showTitlebarAppName')
      }
    ]
  }
}
