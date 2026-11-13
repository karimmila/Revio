import { forkServiceUrl } from '../../../shared/fork-services'

/**
 * Where "Send Feedback" leads: the in-app dialog when this build has its own feedback endpoint,
 * else the fork's issue tracker, else nowhere (every entry point is hidden).
 */
export type AppFeedbackEntry = { kind: 'dialog' } | { kind: 'issues'; url: string } | null

export function appFeedbackEntry(): AppFeedbackEntry {
  if (forkServiceUrl('feedbackUrl')) {
    return { kind: 'dialog' }
  }
  const issuesUrl = forkServiceUrl('issuesUrl')
  return issuesUrl ? { kind: 'issues', url: issuesUrl } : null
}

/** Runs the feedback entry; false when feedback is off so a shortcut can fall through. */
export function openAppFeedback(openDialog: () => void): boolean {
  const entry = appFeedbackEntry()
  if (!entry) {
    return false
  }
  if (entry.kind === 'dialog') {
    openDialog()
  } else {
    openIssueTracker(entry.url)
  }
  return true
}

/** Main adds the app and OS versions to the page; without that bridge the plain page opens. */
function openIssueTracker(url: string): void {
  const support = window.api.support
  if (!support) {
    void window.api.shell.openUrl(url)
    return
  }
  void support.openIssueReport().catch(() => window.api.shell.openUrl(url))
}
