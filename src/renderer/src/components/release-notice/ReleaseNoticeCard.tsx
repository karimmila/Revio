import { useEffect, useState } from 'react'
import type { ReleaseNotice } from '../../../../shared/release-notice'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

/** The newer release main found, kept current; null when there is none or the bridge is absent. */
function useReleaseNotice(): ReleaseNotice | null {
  const [notice, setNotice] = useState<ReleaseNotice | null>(null)
  useEffect(() => {
    const api = window.api.releaseNotice
    if (!api) {
      return
    }
    let live = true
    void api
      .get()
      .then((current) => {
        if (live) {
          setNotice(current)
        }
      })
      .catch(() => undefined)
    const unsubscribe = api.onChanged(setNotice)
    return () => {
      live = false
      unsubscribe()
    }
  }, [])
  return notice
}

/**
 * "A new version is available": this build cannot install updates itself, so the card only opens
 * the release page. It never blocks work and each choice hides it at once.
 */
export function ReleaseNoticeCard(): React.JSX.Element | null {
  const notice = useReleaseNotice()
  if (!notice) {
    return null
  }
  const api = window.api.releaseNotice
  return (
    <Card role="complementary" aria-live="polite" size="sm">
      <div className="flex flex-col gap-3 px-4 py-1.5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">
            {translate('releaseNotice.title', '{{productName}} {{version}} is available', {
              version: notice.version
            })}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {translate(
              'releaseNotice.description',
              'Download it, then drag {{productName}} to Applications to replace this version. Your workspaces and settings stay.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void api?.download()}>
            {translate('releaseNotice.download', 'Download')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void api?.later()}>
            {translate('releaseNotice.later', 'Later')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void api?.skip()}>
            {translate('releaseNotice.skip', 'Skip this version')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
