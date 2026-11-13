import type { Platform } from './MobileHero'
import { translate } from '@/i18n/i18n'
import { forkDocsUrl } from '../../../../shared/fork-services'

/** `url` is null when this build names no site for the Android download; the CTA then hides. */
export type InstallCopy = { ctaLabel: string; url: string | null }

export const IOS_APP_STORE_URL = 'https://apps.apple.com/app/orca-ide/id6766130217'

/** The Android APK and its guide live on the fork's own docs site; null when it has none. */
export function androidInstallGuideUrl(): string | null {
  return forkDocsUrl('/docs/android-apk')
}

export function androidDownloadUrl(): string | null {
  return forkDocsUrl('/download/android')
}

export function getInstallCopy(platform: Platform): InstallCopy {
  return platform === 'ios'
    ? {
        ctaLabel: translate(
          'auto.components.mobile.mobile.platform.copy.openAppStore',
          'Open App Store'
        ),
        url: IOS_APP_STORE_URL
      }
    : {
        ctaLabel: translate(
          'auto.components.mobile.mobile.platform.copy.downloadApk',
          'Download APK'
        ),
        url: androidDownloadUrl()
      }
}
