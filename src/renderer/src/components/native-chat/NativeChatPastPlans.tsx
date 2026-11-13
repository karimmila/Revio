import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { pastPlanAttachmentText, readWorkspacePlans, type PastPlan } from './native-chat-past-plans'

/** "Add plans:" on a fresh chat: this workspace's newest plans in `.context/plans`; a
 * pick puts the plan file in the chat input. */
export function NativeChatPastPlans({
  workspacePath,
  onPick
}: {
  workspacePath: string | null
  onPick: (from: Element, text: string) => void
}): React.JSX.Element | null {
  const [plans, setPlans] = useState<readonly PastPlan[]>([])
  useEffect(() => {
    if (!workspacePath) {
      return
    }
    let current = true
    void readWorkspacePlans(workspacePath).then((found) => {
      if (current) {
        setPlans(found)
      }
    })
    return () => {
      current = false
    }
  }, [workspacePath])
  if (plans.length === 0) {
    return null
  }
  return (
    <div data-native-chat-past-plans className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground">
        {translate('components.native-chat.pastPlans.label', 'Add plans:')}
      </span>
      {plans.map((plan) => (
        <Button
          key={plan.filePath}
          type="button"
          variant="outline"
          size="sm"
          title={plan.filePath}
          className="max-w-56"
          onClick={(event) => onPick(event.currentTarget, pastPlanAttachmentText(plan))}
        >
          <FileText className="size-3.5" />
          <span className="truncate">{plan.title}</span>
        </Button>
      ))}
    </div>
  )
}
