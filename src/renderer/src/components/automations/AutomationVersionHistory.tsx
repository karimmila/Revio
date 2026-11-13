import React from 'react'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { formatAutomationDateTimeWithRelative } from './automation-page-parts'
import { loadAutomationVersions, type AutomationVersion } from './automation-version-history'

/** "Version history": earlier saved versions of a routine, newest first, the newest
 * marked "Current". Revert asks first, then hands the version to the editor to save. */
export function AutomationVersionHistory({
  automationId,
  disabled,
  onRevert
}: {
  automationId: string
  disabled: boolean
  onRevert: (version: AutomationVersion) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [versions, setVersions] = React.useState<AutomationVersion[]>([])
  const [confirming, setConfirming] = React.useState<AutomationVersion | null>(null)
  const [now, setNow] = React.useState(0)
  const currentVersion = versions[0]?.version

  const openHistory = (): void => {
    setVersions(loadAutomationVersions(automationId))
    setNow(Date.now())
    setConfirming(null)
    setOpen(true)
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={openHistory}>
        <History className="size-4" />
        {translate('auto.components.automations.versionHistory.title', 'Version history')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          {confirming ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">
                  {translate(
                    'auto.components.automations.versionHistory.confirmTitle',
                    'Revert to version {{version}}?',
                    { version: confirming.version }
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {translate(
                    'auto.components.automations.versionHistory.confirmDetail',
                    'The name, prompt, agent and schedule are restored and saved. The run location stays as it is.'
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirming(null)}>
                  {translate('auto.components.automations.versionHistory.cancel', 'Cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onRevert(confirming)
                    setOpen(false)
                  }}
                >
                  {translate('auto.components.automations.versionHistory.revert', 'Revert')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">
                  {translate('auto.components.automations.versionHistory.title', 'Version history')}
                </DialogTitle>
              </DialogHeader>
              {versions.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {translate('auto.components.automations.versionHistory.empty', 'No versions')}
                </p>
              ) : (
                <ul className="scrollbar-sleek flex max-h-80 flex-col overflow-y-auto">
                  {versions.map((entry) => (
                    <li
                      key={entry.version}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <span className="shrink-0 text-xs text-muted-foreground">
                        v{entry.version}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{entry.snapshot.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatAutomationDateTimeWithRelative(entry.savedAt, now)}
                      </span>
                      {entry.version === currentVersion ? (
                        <Badge variant="secondary">
                          {translate(
                            'auto.components.automations.versionHistory.current',
                            'Current'
                          )}
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={disabled}
                          onClick={() => setConfirming(entry)}
                        >
                          {translate('auto.components.automations.versionHistory.revert', 'Revert')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
