import React from 'react'
import { Plug } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import PortsPanel from '@/components/right-sidebar/PortsPanel'
import { useActiveCloudEnvironmentId } from './RevioCloudDesktopPanel'
import { RevioCloudPublicPorts } from './RevioCloudPublicPorts'

/**
 * The workspace layout keeps ports behind a plug icon in the workspace's top bar. This opens Orca's
 * own Ports panel there: detected listening ports and forwards to localhost, local or remote. A
 * cloud workspace also lists its public links there.
 */
export function RevioPortsButton({ className }: { className: string }): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const cloudEnvironmentId = useActiveCloudEnvironmentId()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-revio-ports-button=""
          aria-label={translate('auto.components.revioLayout.ports', 'Ports')}
          title={translate('auto.components.revioLayout.ports', 'Ports')}
          className={className}
        >
          <Plug className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-96"
        // The panel's forward dialog renders outside the popover; interacting with it must not close
        // the popover, which would unmount the dialog with it.
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest('[role="dialog"]')) {
            event.preventDefault()
          }
        }}
      >
        <div data-revio-ports-panel="" className="max-h-[420px] overflow-y-auto scrollbar-sleek">
          <PortsPanel isVisible={open} />
          {cloudEnvironmentId && (
            <RevioCloudPublicPorts environmentId={cloudEnvironmentId} isVisible={open} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
