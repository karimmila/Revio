import React from 'react'
import { useAppStore } from '@/store'
import { persistFloatingTerminalPanelOpen } from '@/components/floating-terminal/floating-terminal-panel-view-state'

/**
 * The terminal dock opens and folds through the store's own setter, past the app shell's toggle
 * that saves the floating panel's state (use-floating-workspace-panel). Without this the dock came
 * back folded after every restart. Saving on change only keeps startup from overwriting the
 * restored value.
 */
export function useRevioDockOpenPersistence(): void {
  React.useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        if (
          state.floatingWorkspacePanelOpen !== previous.floatingWorkspacePanelOpen &&
          // A panel switched off in settings closes without the person folding it; keep their choice.
          state.settings?.floatingTerminalEnabled === true
        ) {
          persistFloatingTerminalPanelOpen(state.floatingWorkspacePanelOpen)
        }
      }),
    []
  )
}
