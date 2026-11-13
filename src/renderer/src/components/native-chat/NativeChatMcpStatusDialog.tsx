import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { readNativeChatAccountUsageModalRequest } from './native-chat-account-usage-modal'
import { useNativeChatMcpStatus } from './use-native-chat-mcp-status'
import { McpStatusBody } from './NativeChatMcpStatusBody'

/** "MCP status": the chat's MCP servers, their state and tool count, with Refresh. */
export default function NativeChatMcpStatusDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  // The same chat-and-host request shape `/usage` opens with.
  const [request] = useState(() => readNativeChatAccountUsageModalRequest(modalData))
  const { shown, reload: load } = useNativeChatMcpStatus(request, true)
  if (!request) {
    return null
  }
  return (
    <Dialog open onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[520px]" aria-describedby={undefined}>
        <div className="flex items-center justify-between gap-2">
          <DialogTitle>
            {translate('components.native-chat.mcpStatus.title', 'MCP status')}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={load}
            disabled={shown.kind === 'loading'}
          >
            <RefreshCw className="size-3" />
            {translate('components.native-chat.mcpStatus.refresh', 'Refresh')}
          </Button>
        </div>
        <McpStatusBody shown={shown} />
      </DialogContent>
    </Dialog>
  )
}
