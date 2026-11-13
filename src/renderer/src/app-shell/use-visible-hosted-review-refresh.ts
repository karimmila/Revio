import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { installWindowVisibilityInterval, isWindowVisible } from '@/lib/window-visibility-interval'
import { noteRevioRateLimit } from '@/store/github/revio-review-poll-interval'
import { isWebClientLocation } from '@/lib/web-client-location'
import { createVisibleHostedReviewRefreshScheduler } from '@/store/github/visible-hosted-review-refresh-scheduler'
import { getWorkspaceReferenceRefreshTargets } from '@/components/sidebar/workspace-card/review/workspace-reference-refresh-targets'
import {
  getVisibleHostedReviewRefreshTargets,
  visibleHostedReviewRefreshInputsChanged
} from '@/store/github/visible-hosted-review-refresh-targets'

export function useVisibleHostedReviewRefresh({ enabled }: { enabled: boolean }): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const scheduler = createVisibleHostedReviewRefreshScheduler()
    const update = (): void => {
      const state = useAppStore.getState()
      const selectedOnly = isWebClientLocation()
      scheduler.update([
        ...getVisibleHostedReviewRefreshTargets(state, useAppStore.getState, { selectedOnly }),
        ...getWorkspaceReferenceRefreshTargets(state, { selectedOnly })
      ])
    }
    const visibilityChanged = (): void => {
      scheduler.setVisible(false)
      update()
      scheduler.setVisible(isWindowVisible())
    }
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (visibleHostedReviewRefreshInputsChanged(state, previous)) {
        update()
      }
    })
    update()
    visibilityChanged()
    document.addEventListener('visibilitychange', visibilityChanged)
    // Focus changes the selected poll's cadence (10s focused, 60s blurred); re-reading the
    // targets on focus also makes a stale selected review due now, so it refreshes at once.
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    // The workspace layout's 10s selected-PR poll slows down when the GraphQL budget runs low.
    // The snapshot is main's cached one, re-read from GitHub at most once per its cache window.
    const stopBudgetWatch = installWindowVisibilityInterval({
      intervalMs: 60_000,
      run: () => {
        if (useAppStore.getState().settings?.revioLayout !== true || !window.api?.gh?.rateLimit) {
          return
        }
        void window.api.gh
          .rateLimit()
          .then(noteRevioRateLimit)
          .catch(() => noteRevioRateLimit(null))
      }
    })
    return () => {
      stopBudgetWatch()
      unsubscribe()
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      scheduler.dispose()
    }
  }, [enabled])
}
