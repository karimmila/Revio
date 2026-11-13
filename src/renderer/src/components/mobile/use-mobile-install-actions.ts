import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import type { Platform } from './MobileHero'
import { androidInstallGuideUrl, getInstallCopy } from './mobile-platform-copy'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'

export function useMobileInstallActions(platform: Platform): {
  copyInstallUrl: () => Promise<void>
  openAndroidInstallGuide: () => void
  openInstallUrl: () => void
} {
  const mountedRef = useMountedRef()

  const openInstallUrl = useCallback((): void => {
    const url = getInstallCopy(platform).url
    if (url) {
      openAppHttpLink(url)
    }
  }, [platform])

  const openAndroidInstallGuide = useCallback((): void => {
    const url = androidInstallGuideUrl()
    if (url) {
      openAppHttpLink(url)
    }
  }, [])

  const copyInstallUrl = useCallback(async (): Promise<void> => {
    const url = getInstallCopy(platform).url
    if (!url) {
      return
    }
    try {
      await window.api.ui.writeClipboardText(url)
      if (mountedRef.current) {
        toast.success(
          translate('auto.components.mobile.MobilePage.fad833de8d', 'Install link copied')
        )
      }
    } catch (error) {
      console.error('writeClipboardText failed', error)
      if (mountedRef.current) {
        toast.error(
          translate('auto.components.mobile.MobilePage.baea63c445', 'Failed to copy link')
        )
      }
    }
  }, [mountedRef, platform])

  return { copyInstallUrl, openAndroidInstallGuide, openInstallUrl }
}
