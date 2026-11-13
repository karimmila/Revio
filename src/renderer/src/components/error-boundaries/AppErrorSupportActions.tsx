import { Bug, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { appFeedbackEntry } from '@/lib/app-feedback-entry'
import { translate } from '@/i18n/i18n'

/**
 * Ways forward on the app-level error screen: reload the window, report the problem, find the
 * logs. Agents and terminals run outside the window, so a reload does not stop them.
 */
export function AppErrorSupportActions(): React.JSX.Element {
  const support = window.api?.support
  const canReport = appFeedbackEntry()?.kind === 'issues' && Boolean(support)
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          void (window.api?.app?.reload?.() ?? Promise.reject(new Error('no bridge'))).catch(() =>
            window.location.reload()
          )
        }}
      >
        <RefreshCw className="size-3.5" />
        {translate('app.recoverableError.reload', 'Reload')}
      </Button>
      {canReport ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void support?.openIssueReport().catch(() => undefined)}
        >
          <Bug className="size-3.5" />
          {translate('app.recoverableError.reportIssue', 'Report an issue')}
        </Button>
      ) : null}
      {support ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void support.openLogsFolder().catch(() => undefined)}
        >
          <FolderOpen className="size-3.5" />
          {translate('app.recoverableError.openLogs', 'Open logs folder')}
        </Button>
      ) : null}
    </>
  )
}
