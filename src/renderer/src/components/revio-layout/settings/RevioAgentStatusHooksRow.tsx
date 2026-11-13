import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The one-line notice: where hooks are, or that none are written. */
export function agentStatusHooksNotice(files: readonly string[]): string {
  return files.length > 0
    ? translate(
        'auto.components.revioLayout.settings.agentStatusHooksFiles',
        'Hooks are written in: {{files}}',
        { files: files.join(', ') }
      )
    : translate(
        'auto.components.revioLayout.settings.agentStatusHooksNone',
        'No agent settings file holds hooks.'
      )
}

/**
 * Nothing shows until main says this build manages status hooks. An installed app does not: its
 * hooks folder is the upstream app's too, so neither the switch nor Remove may be offered there.
 */
export function RevioAgentStatusHooksRow(): React.JSX.Element | null {
  const [available, setAvailable] = React.useState(false)
  React.useEffect(() => {
    let current = true
    void (window.api.agentStatus.statusHooksAvailable?.() ?? Promise.resolve(false))
      .then((answer) => current && setAvailable(answer === true))
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [])
  return available ? <StatusHooksRow /> : null
}

/**
 * Status hooks live in each agent's own settings file, outside this app. They are off until the
 * person turns them on here, and this row names every file they are in and takes them out again.
 */
function StatusHooksRow(): React.JSX.Element {
  const { settings } = useRevioSettings()
  const updateSettings = useAppStore((s) => s.updateSettings)
  const on = settings.agentStatusHooksEnabled === true
  const [files, setFiles] = React.useState<readonly string[]>([])
  const [busy, setBusy] = React.useState(false)
  const live = React.useRef(true)
  const readFiles = React.useCallback(async (): Promise<void> => {
    const listed = (await window.api.agentStatus.listManagedHookFiles?.().catch(() => [])) ?? []
    if (live.current) {
      setFiles(listed)
    }
  }, [])
  React.useEffect(() => {
    live.current = true
    void readFiles()
    return () => {
      live.current = false
    }
  }, [readFiles])
  // Main installs or removes the hooks before the settings write returns, so the list is read after.
  const setEnabled = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    try {
      await updateSettings({ agentStatusHooksEnabled: enabled })
      await readFiles()
    } finally {
      if (live.current) {
        setBusy(false)
      }
    }
  }
  const label = translate(
    'auto.components.revioLayout.settings.agentStatusHooks',
    'Status of agents in the terminal'
  )
  const notice =
    on || files.length > 0 ? (
      <div className="flex items-start gap-3 text-[12px] text-muted-foreground">
        <span className="min-w-0 flex-1 break-words">{agentStatusHooksNotice(files)}</span>
        {files.length > 0 ? (
          <button
            type="button"
            data-revio-settings-button=""
            disabled={busy}
            onClick={() => void setEnabled(false)}
          >
            {translate(
              'auto.components.revioLayout.settings.agentStatusHooksRemove',
              'Remove hooks'
            )}
          </button>
        ) : null}
      </div>
    ) : null
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.agentStatusHooksDescription',
        'Chats show their status without this. Turn it on to see working and waiting for an agent you start in the terminal. {{productName}} then adds status hooks to the settings file of each agent installed on this Mac.'
      )}
      control={
        <RevioSwitch
          label={label}
          checked={on}
          disabled={busy}
          onChange={(checked) => void setEnabled(checked)}
        />
      }
      below={notice}
    />
  )
}
