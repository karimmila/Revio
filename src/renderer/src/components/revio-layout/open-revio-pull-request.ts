import { useAppStore } from '@/store'
import { revioPullRequestUrl } from '../../../../shared/revio-pr-open-target'

/** Opens a PR link where Settings > Git > "Open pull requests in" says: GitHub, Linear, Graphite or an Orca browser tab. */
export function openRevioPullRequest(url: string): void {
  const state = useAppStore.getState()
  const target = state.settings?.revioOpenPullRequestsIn ?? 'github'
  if (target === 'app') {
    void state.openBrowserProfileTabInActiveWorkspace(url, null).then((opened) => {
      if (!opened) {
        void window.api.shell.openUrl(url)
      }
    })
    return
  }
  void window.api.shell.openUrl(revioPullRequestUrl(url, target))
}
