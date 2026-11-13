import { useAppStore } from '@/store'
import { setRevioLayoutKeymap } from '../../../shared/keybindings/revio-keymap'

/**
 * Keeps this window's keymap on the keys while the workspace layout is on. Main keeps its
 * own copy for the menu and guest pages. A switch re-sends the bindings snapshot, so every
 * computed shortcut and label reads the new defaults.
 */
export function syncRevioLayoutKeymap(): () => void {
  const apply = (): void => {
    const state = useAppStore.getState()
    if (setRevioLayoutKeymap(state.settings?.revioLayout === true) && state.keybindingSnapshot) {
      state.setKeybindingSnapshot({ ...state.keybindingSnapshot })
    }
  }
  apply()
  return useAppStore.subscribe((state, previous) => {
    if (state.settings?.revioLayout !== previous.settings?.revioLayout) {
      apply()
    }
  })
}
