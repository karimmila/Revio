import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentIcon } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { TerminalAgent } from '../../../../shared/agent-status/identity/terminal-agent'
import '../sidebar/workspace-card/activity/worktree-card-empty-inputs'
import { FilledBellIcon } from '../sidebar/workspace-card/identity/worktree-card-glyphs'
import { ShellIcon } from './shell-icons'
import {
  terminalTabActivityToAgentDotState,
  type TerminalTabActivityStatus
} from './terminal-tab-activity-status'
import { translate } from '@/i18n/i18n'
import { Laptop } from 'lucide-react'
import { useRevioLayout } from '@/components/revio-layout/revio-layout'

type TerminalTabLeadingIconProps = {
  agent: TerminalAgent | null
  activityStatus: TerminalTabActivityStatus
  shell: TerminalTab['shellOverride']
  showUnreadActivity: boolean
  isActive: boolean
  /** Program-reported 0–100 for the tab's live work; fills the state ring. */
  progress?: number
  isNativeChat?: boolean
}

type TerminalTabAgentIdentityIconProps = {
  agent: TerminalAgent
  isActive: boolean
  className?: string
}

function TerminalTabAgentIdentityIcon({
  agent,
  isActive,
  className
}: TerminalTabAgentIdentityIconProps): React.JSX.Element {
  return (
    <span
      className={cn('inline-flex', !isActive && 'opacity-70', className)}
      data-agent-icon={agent}
      aria-hidden
    >
      <AgentIcon agent={agent} size={12} />
    </span>
  )
}

export function TerminalTabLeadingIcon({
  agent,
  activityStatus,
  shell,
  showUnreadActivity,
  isActive,
  progress,
  isNativeChat = false
}: TerminalTabLeadingIconProps): React.JSX.Element | null {
  const revioLayout = useRevioLayout()
  // The chat tabs carry no agent logo; only live state (unread, working) gets a mark.
  const agentIcon = revioLayout && isNativeChat ? null : agent
  if (showUnreadActivity) {
    return (
      <span
        data-testid="tab-activity-bell"
        aria-label={translate(
          'auto.components.tab.bar.TerminalTabLeadingIcon.7ab2964bea',
          'Unread agent completion'
        )}
        className="mr-1 inline-flex shrink-0 items-center gap-1"
      >
        <FilledBellIcon className="size-3 text-amber-500 drop-shadow-sm" />
        {agentIcon ? <TerminalTabAgentIdentityIcon agent={agentIcon} isActive={isActive} /> : null}
      </span>
    )
  }

  // Share activity mapping with recent-tab badges; idle states retain agent/shell identity.
  const dotState = terminalTabActivityToAgentDotState(activityStatus)
  if (dotState) {
    return (
      <span
        data-testid="tab-agent-activity-indicator"
        data-agent-activity-status={activityStatus}
        className="mr-1 inline-flex shrink-0 items-center gap-1"
      >
        {/* Why: the state glyph is self-describing and the tab title already has a tooltip; hover here stays quiet. */}
        <AgentStateDot state={dotState} size="md" title={null} progress={progress} />
        {/* Keep agent identity beside activity so parallel tabs remain distinguishable. */}
        {agentIcon ? <TerminalTabAgentIdentityIcon agent={agentIcon} isActive={isActive} /> : null}
      </span>
    )
  }

  if (revioLayout && isNativeChat) {
    return null
  }

  if (agent) {
    return (
      <TerminalTabAgentIdentityIcon agent={agent} isActive={isActive} className="mr-1 shrink-0" />
    )
  }

  return (
    <span
      className={`mr-1 inline-flex shrink-0 ${isActive ? '' : 'opacity-70'}`}
      data-shell-icon={shell ?? 'generic'}
      aria-hidden
    >
      {/* The layout marks a terminal tab with a thin laptop outline, not a filled shell glyph. */}
      {revioLayout ? (
        <Laptop className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      ) : (
        <ShellIcon shell={shell} size={12} />
      )}
    </span>
  )
}
