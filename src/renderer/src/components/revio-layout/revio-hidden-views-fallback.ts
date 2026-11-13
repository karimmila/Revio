import { useEffect } from 'react'
import { useAppStore } from '@/store'

/** The workspace layout has no Routines page and no task board, yet a restored session,
 * back/forward history or a badge can still set those views. Leave them for the view they came
 * from so the main area never goes blank. */
export function leaveHiddenViewInRevio(): void {
  const state = useAppStore.getState()
  if (state.activeView === 'automations') {
    state.closeAutomationsPage()
  } else if (state.activeView === 'tasks') {
    state.closeTaskPage()
  }
}

export function RevioHiddenViewsFallback(): null {
  // The whole view, not a flag: Tasks can hand back to Routines, which must be left too.
  const activeView = useAppStore((s) => s.activeView)
  useEffect(() => {
    leaveHiddenViewInRevio()
  }, [activeView])
  return null
}
