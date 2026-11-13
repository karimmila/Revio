import { useState } from 'react'
import { Plug, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { NativeChatAccountUsageModalRequest } from './native-chat-account-usage-modal'
import { McpStatusBody } from './NativeChatMcpStatusBody'
import { useNativeChatMcpStatus } from './use-native-chat-mcp-status'

/**
 * The composer "MCP servers" button: a popover headed "MCPs" with Refresh, listing the
 * chat's MCP servers. The status is read each time the popover opens.
 */
export function NativeChatComposerMcpStatusPopover({
  request
}: {
  request: NativeChatAccountUsageModalRequest
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { shown, reload } = useNativeChatMcpStatus(request, open)
  const label = translate('components.native-chat.mcpStatus.servers', 'MCP servers')
  const loading = shown.kind === 'loading'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              data-native-chat-mcp-status=""
              className="pointer-coarse:size-11"
              onMouseDown={(event) => event.preventDefault()}
            >
              <Plug className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        aria-label={label}
        side="top"
        align="end"
        sideOffset={8}
        className="w-72"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-2 px-2.5 pt-1.5 pb-2.5">
          <div className="flex items-center justify-between pl-1.5">
            <span className="text-xs font-medium">
              {translate('components.native-chat.mcpStatus.popoverTitle', 'MCPs')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={translate(
                'components.native-chat.mcpStatus.refreshAria',
                'Refresh MCP status'
              )}
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
            </Button>
          </div>
          <McpStatusBody shown={shown} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
