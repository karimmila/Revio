import React from 'react'
import { Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getNotificationSoundOptions } from '@/components/notification-sound-options'
import { RevioSelect } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

type SoundId = ReturnType<typeof useRevioSettings>['settings']['notifications']['customSoundId']

/** The sound picker with Test. A custom file stays selectable once Orca's page set one. */
export function CompletionSoundControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const notifications = settings.notifications
  const options = getNotificationSoundOptions(notifications.customSoundPath).filter(
    (option) => option.id !== 'custom' || Boolean(notifications.customSoundPath)
  )
  const play = async (): Promise<void> => {
    const result = await window.api.notifications.playSound({
      force: true,
      volume: notifications.customSoundVolume
    })
    if (!result.played) {
      toast.error(
        translate(
          'auto.components.revioLayout.settings.soundFailed',
          'The sound could not be played.'
        )
      )
    }
  }
  return (
    <>
      <RevioSelect<SoundId>
        label={translate('auto.components.revioLayout.settings.sound', 'Completion sound')}
        value={notifications.customSoundId}
        options={options.map((option) => ({ value: option.id, label: option.title }))}
        onChange={(customSoundId) => update({ notifications: { ...notifications, customSoundId } })}
      />
      <button
        type="button"
        data-revio-settings-text-button=""
        disabled={
          notifications.customSoundId === 'system' || notifications.customSoundId === 'none'
        }
        title={
          notifications.customSoundId === 'system'
            ? translate(
                'auto.components.revioLayout.settings.systemSoundNoPreview',
                'The system sound has no preview.'
              )
            : undefined
        }
        onClick={() => void play()}
      >
        <Volume2 className="size-3.5" />
        {translate('auto.components.revioLayout.settings.test', 'Test')}
      </button>
    </>
  )
}

const FULL_DISK_ACCESS = 'full-disk-access'

/** Shows whether macOS granted Full Disk Access and opens the pane; rechecks when Orca regains focus. */
export function FullDiskAccessControl(): React.JSX.Element {
  const [granted, setGranted] = React.useState<boolean | null>(null)
  const refresh = React.useCallback(() => {
    void window.api.developerPermissions
      .getStatus()
      .then((states) => {
        const status = states.find((state) => state.id === FULL_DISK_ACCESS)?.status
        setGranted(status === undefined ? null : status === 'granted')
      })
      .catch(() => setGranted(null))
  }, [])
  React.useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return (
    <>
      {granted !== null ? (
        <span data-revio-settings-status="">
          {granted
            ? translate('auto.components.revioLayout.settings.granted', 'Granted')
            : translate('auto.components.revioLayout.settings.notGranted', 'Not granted')}
        </span>
      ) : null}
      <button
        type="button"
        data-revio-settings-button=""
        onClick={() =>
          void window.api.developerPermissions.request({ id: FULL_DISK_ACCESS }).then(refresh)
        }
      >
        {translate(
          'auto.components.revioLayout.settings.openSystemSettings',
          'Open System Settings'
        )}
      </button>
    </>
  )
}
