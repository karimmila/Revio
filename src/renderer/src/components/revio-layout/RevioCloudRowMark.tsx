import React from 'react'
import { Cloud, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  refreshAsleepCloudEnvironmentsSoon,
  useIsCloudRepoAsleep
} from '@/lib/cloud-asleep-environments'
import type { Repo } from '../../../../shared/repo-types'

/** The cloud mark of a sidebar row; asleep, a moon joins it and the cloud dims. */
export function RevioCloudMark({ asleep }: { asleep: boolean }): React.JSX.Element {
  return (
    <>
      {asleep ? (
        <span
          data-revio-row-asleep=""
          className="flex shrink-0 items-center"
          title={translate('auto.components.revioLayout.rowAsleepHint', 'Asleep. Open to wake it.')}
        >
          <Moon
            aria-label={translate('auto.components.revioLayout.rowAsleep', 'Asleep')}
            className="size-3 text-muted-foreground"
          />
        </span>
      ) : null}
      <Cloud
        aria-label={translate('auto.components.revioLayout.cloudWorkspace', 'Cloud workspace')}
        className={cn('size-3 shrink-0 text-muted-foreground', asleep && 'opacity-40')}
      />
    </>
  )
}

/**
 * A cloud workspace's row mark. The workspace on screen never reads as asleep: opening it is what
 * wakes it, and the sandbox's record follows a few seconds later.
 */
export function RevioCloudRowMark({
  repo,
  active
}: {
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | null | undefined
  active: boolean
}): React.JSX.Element {
  const asleep = useIsCloudRepoAsleep(repo)
  React.useEffect(() => {
    if (active && asleep) {
      refreshAsleepCloudEnvironmentsSoon()
    }
  }, [active, asleep])
  return <RevioCloudMark asleep={asleep && !active} />
}
