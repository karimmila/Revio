import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { QuickStartTemplate } from '../../../../../../shared/quick-start-types'

/** What the Create step's Quick start options asked for; read once the local repo exists. */
export type QuickStartChoice = { template: QuickStartTemplate; publishToGithub: boolean }

const NONE: QuickStartChoice = { template: 'none', publishToGithub: false }
let choice: QuickStartChoice = NONE
const listeners = new Set<() => void>()

export function setQuickStartChoice(next: QuickStartChoice): void {
  choice = next
  for (const listener of listeners) {
    listener()
  }
}

export function useQuickStartChoice(): QuickStartChoice {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => choice
  )
}

/** Applies the chosen template and GitHub repo to a project just created on this computer. */
export async function runQuickStartChoice(repoPath: string, name: string): Promise<void> {
  const current = choice
  setQuickStartChoice(NONE)
  const api = window.api.githubRepos
  if (!api || (current.template === 'none' && !current.publishToGithub)) {
    return
  }
  const result = await api.quickStart({ repoPath, name, ...current })
  if (!result.ok) {
    toast.error(
      translate('auto.components.sidebar.quickStart.failed', 'Quick start did not finish.'),
      { description: result.error }
    )
  } else if (result.githubUrl) {
    toast.success(
      translate(
        'auto.components.sidebar.quickStart.published',
        'Private GitHub repository created'
      ),
      { description: result.githubUrl }
    )
  }
}
