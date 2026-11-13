import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '@/store'
import type { CmdJQuickAction } from './quick-actions'

/** One workspace-layout palette action; most need a workspace on screen. */
export function action(
  id: string,
  title: string,
  icon: LucideIcon,
  keywords: string[],
  run: () => void,
  needsWorkspace = true
): CmdJQuickAction {
  return {
    id: `revio:${id}`,
    kind: 'action',
    title,
    description: '',
    icon,
    verbKeywords: keywords,
    isAvailable: () =>
      needsWorkspace && !useAppStore.getState().activeWorktreeId
        ? { available: false, reason: 'no-active-workspace' }
        : { available: true },
    run: async () => {
      run()
      return { status: 'ok' }
    }
  }
}
