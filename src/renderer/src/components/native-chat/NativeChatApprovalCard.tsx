import { SecuritySurface } from '@/components/ui/security-surface'
import { useRef, useState } from 'react'
import { ChevronDown, ShieldQuestion, X } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { approvalDetailPreview } from '../../../../shared/agent-session/agent-session-approval-detail-preview'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { NativeChatMarkdown } from './NativeChatMarkdown'
import { approvalBlockedPathToShow } from '../../../../shared/agent-session/agent-session-approval-blocked-path'
import {
  isNewerApprovalSubject,
  isPlanApprovalSubject
} from '../../../../shared/agent-session/agent-session-approval-subject'
import { NativeChatCodeBlock } from './NativeChatCodeBlock'
import type { ChatApproval } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { NativeChatPromptCollapseToggle } from './NativeChatPromptCollapse'
import { useNativeChatPromptCardFocus } from './use-native-chat-prompt-card-focus'
import { NativeChatPlanActions } from './NativeChatPlanActions'

export type NativeChatApprovalCardProps = {
  approval: ChatApproval
  /** Deliver the option's transport-specific response token. */
  onChoose: (option: string) => void
  /** Cancel the active provider turn while this card owns the composer region. */
  onCancel?: () => void
  /** Without `onCancel`: fold the card to a strip and give the input back, writing nothing. */
  onCollapse?: () => void
  /** A choice is being delivered: the options wait for its answer. */
  isSubmitting?: boolean
  shouldFocus?: boolean
  /** A plan's Hand off: the plan goes to a new chat and this turn stops. */
  onHandOffPlan?: (plan: string, filePath?: string) => void
}

/** PTY options are literal replies; structured options are journal ids. Style the first option as primary. */
export function NativeChatApprovalCard({
  approval,
  onChoose,
  onCancel,
  onCollapse,
  isSubmitting = false,
  shouldFocus = false,
  onHandOffPlan
}: NativeChatApprovalCardProps): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const neededPath = approvalBlockedPathToShow(approval)
  const authorizationUrl = openableAuthorizationUrl(approval.authorizationUrl)
  // A newer Orca's subject: its detail is shown, and only the card's cancel answers.
  const newerSubject = isNewerApprovalSubject(approval.subject)
  const hasContext = Boolean(
    approval.description ||
    approval.decisionReason ||
    neededPath ||
    authorizationUrl ||
    approval.subject ||
    approval.detail
  )
  useNativeChatPromptCardFocus(cardRef, shouldFocus)
  const escape = onCancel ?? (isSubmitting ? undefined : onCollapse)
  const plan = isPlanApprovalSubject(approval.subject) ? approval.subject : null

  return (
    <SecuritySurface>
      <div className="min-h-0 shrink overflow-hidden bg-chat-pane">
        <div className="mx-auto flex h-full min-h-0 max-h-full w-full max-w-(--chat-content-max-width) px-3 pt-2 pb-1 sm:px-4">
          <div
            ref={cardRef}
            data-native-chat-prompt-card-focus={shouldFocus || undefined}
            data-native-chat-approval-card="true"
            role="group"
            aria-label={approval.title}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.nativeEvent.isComposing && escape) {
                event.preventDefault()
                event.stopPropagation()
                escape()
              }
            }}
            className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden rounded-lg border border-input bg-card px-4 py-3 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex shrink-0 items-start gap-2">
              <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-sm font-semibold text-foreground">
                  {approval.title}
                </p>
              </div>
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label={translate('components.native-chat.approval.cancel', 'Cancel')}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
              ) : onCollapse ? (
                <NativeChatPromptCollapseToggle
                  expanded
                  disabled={isSubmitting}
                  onToggle={onCollapse}
                />
              ) : null}
            </div>
            {hasContext ? (
              <div
                ref={contentRef}
                data-native-chat-approval-content="true"
                tabIndex={0}
                className="min-h-0 max-h-72 shrink space-y-2 overflow-auto text-sm text-muted-foreground scrollbar-sleek focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {approval.description ? (
                  <p className="whitespace-pre-wrap break-words">{approval.description}</p>
                ) : null}
                {approval.decisionReason ? (
                  <p className="whitespace-pre-wrap break-words">
                    <span className="font-medium text-foreground">
                      {translate('components.native-chat.approval.reason', 'Reason')}:{' '}
                    </span>
                    {approval.decisionReason}
                  </p>
                ) : null}
                {neededPath ? (
                  <p className="break-words">
                    <span className="font-medium text-foreground">
                      {translate('components.native-chat.approval.needsAccess', 'Needs access to')}
                      :{' '}
                    </span>
                    <span className="font-mono">{neededPath}</span>
                  </p>
                ) : null}
                {authorizationUrl ? (
                  <p className="break-all font-mono" data-native-chat-approval-url="true">
                    {authorizationUrl}
                  </p>
                ) : null}
                {isPlanApprovalSubject(approval.subject) ? (
                  <div data-native-chat-approval-plan="true">
                    <NativeChatMarkdown
                      content={approval.subject.text}
                      variant="document"
                      className="text-sm text-chat-foreground"
                      renderCodeBlock={NativeChatCodeBlock}
                      linkifyFilePaths
                    />
                    {approval.subject.filePath ? (
                      <p className="mt-2 break-all">
                        <span className="font-medium text-foreground">
                          {translate('components.native-chat.approval.plan.file', 'Plan file')}
                          :{' '}
                        </span>
                        <span className="font-mono">{approval.subject.filePath}</span>
                      </p>
                    ) : null}
                  </div>
                ) : approval.detail ? (
                  <NativeChatApprovalDetail
                    detail={approval.detail}
                    scrollContainerRef={contentRef}
                  />
                ) : null}
                {newerSubject ? (
                  <p data-native-chat-approval-needs-newer-orca="true" className="break-words">
                    {translate(
                      'components.native-chat.approval.needsNewerOrca',
                      'This request needs a newer version of {{productName}}.'
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div
                data-native-chat-approval-actions="true"
                className="flex shrink-0 flex-wrap gap-2"
              >
                {authorizationUrl ? (
                  <button
                    type="button"
                    data-native-chat-approval-open-url="true"
                    onClick={() => void window.api.shell.openUrl(authorizationUrl).catch(() => {})}
                    className="rounded-md border border-border bg-background px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {translate(
                      'components.native-chat.approval.openAuthorizationPage',
                      'Open authorization page'
                    )}
                  </button>
                ) : null}
                {approval.options.map((opt, i) => (
                  <button
                    key={`${opt.label}-${i}`}
                    type="button"
                    disabled={newerSubject || isSubmitting}
                    onClick={() => onChoose(opt.send)}
                    title={
                      plan && i === 0
                        ? translate(
                            'components.native-chat.approval.plan.executeHint',
                            'Execute plan in current chat'
                          )
                        : undefined
                    }
                    className={cn(
                      'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                      i === 0
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {plan ? (
                <NativeChatPlanActions
                  plan={plan.text}
                  onHandOff={
                    onHandOffPlan && !isSubmitting
                      ? () => onHandOffPlan(plan.text, plan.filePath)
                      : undefined
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SecuritySurface>
  )
}

/** Only web pages open from a card; a provider-sent URL with another scheme is shown, not opened. */
export function openableAuthorizationUrl(url: string | undefined): string | null {
  if (!url) {
    return null
  }
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function NativeChatApprovalDetail({
  detail,
  scrollContainerRef
}: {
  detail: string
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const preview = approvalDetailPreview(detail)
  const hasMore = preview !== detail
  const textClassName = 'whitespace-pre-wrap break-words font-mono text-chat-code'
  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => {
        const scroller = scrollContainerRef.current
        const trigger = triggerRef.current
        if (!open && scroller && trigger) {
          const rowBottom =
            trigger.getBoundingClientRect().bottom -
            scroller.getBoundingClientRect().top -
            scroller.clientTop +
            scroller.scrollTop
          scroller.scrollTop = Math.max(0, rowBottom - scroller.clientHeight)
        }
        setExpanded(open)
      }}
    >
      <div className="space-y-2">
        {hasMore ? (
          <CollapsibleTrigger ref={triggerRef} variant="row">
            {translate('components.native-chat.notices.details', 'Details')}
            <ChevronDown className="size-4 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        ) : null}
        {!expanded ? (
          <div
            data-native-chat-approval-detail="true"
            data-native-chat-code-content
            className={textClassName}
          >
            {preview}
          </div>
        ) : null}
        <CollapsibleContent>
          <div
            data-native-chat-approval-detail="true"
            data-native-chat-code-content
            className={textClassName}
          >
            {detail}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
