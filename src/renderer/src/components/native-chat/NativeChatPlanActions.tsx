import { useState } from 'react'
import { Check, Copy, Forward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

/**
 * The plan review actions beside Approve: Copy the plan, and Hand off ("Send plan to a
 * new chat for implementation"). They sit outside the approval options so ↵/⌫ keep their order.
 */
export function NativeChatPlanActions({
  plan,
  onHandOff
}: {
  plan: string
  onHandOff?: () => void
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void window.api.ui.writeClipboardText(plan).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div data-native-chat-plan-actions="true" className="ml-auto flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="xs" onClick={copy}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied
              ? translate('components.native-chat.approval.plan.copied', 'Copied')
              : translate('components.native-chat.approval.plan.copy', 'Copy')}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {copied
            ? translate('components.native-chat.approval.plan.copiedHint', 'Copied to clipboard')
            : translate('components.native-chat.approval.plan.copyHint', 'Copy plan to clipboard')}
        </TooltipContent>
      </Tooltip>
      {onHandOff ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="xs" onClick={onHandOff}>
              <Forward className="size-3" />
              {translate('components.native-chat.approval.plan.handOff', 'Hand off')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate(
              'components.native-chat.approval.plan.handOffHint',
              'Send plan to a new chat for implementation'
            )}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
