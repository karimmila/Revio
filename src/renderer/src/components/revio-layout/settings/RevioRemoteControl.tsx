import React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSelect } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

const AUTOMATIC = '__automatic__'

/**
 * "Remote": where push, pull/fetch and PR lookup go for this repository. Automatic
 * keeps Orca's fork-aware choice per action; a named remote pins all three to it.
 */
export function RevioRemoteControl({ repoId }: { repoId: string }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [remotes, setRemotes] = React.useState<string[]>([])
  React.useEffect(() => {
    let live = true
    void window.api.repoActions
      ?.listRemotes(repoId)
      .catch((): string[] => [])
      .then((next) => {
        if (live) {
          setRemotes(next)
        }
      })
    return () => {
      live = false
    }
  }, [repoId])
  const pinned = settings.revioRepoRemotes?.[repoId]
  const names = pinned && !remotes.includes(pinned) ? [...remotes, pinned] : remotes
  return (
    <RevioSelect
      label={translate('auto.components.revioLayout.settings.repoRemote', 'Remote')}
      value={pinned ?? AUTOMATIC}
      options={[
        {
          value: AUTOMATIC,
          label: translate('auto.components.revioLayout.settings.repoRemoteAutomatic', 'Automatic')
        },
        ...names.map((name) => ({ value: name, label: name }))
      ]}
      onChange={(value) => {
        const { [repoId]: _previous, ...rest } = settings.revioRepoRemotes ?? {}
        update({
          revioRepoRemotes: value === AUTOMATIC ? rest : { ...rest, [repoId]: value }
        })
      }}
    />
  )
}
