import React from 'react'
import { ChevronDown, Settings2, Terminal } from 'lucide-react'
import type AgentCombobox from '@/components/agent/AgentCombobox'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import { AgentDefaultContextMenu } from '@/components/agent/agent-combobox-items'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import { useRevioLayout } from '../revio-layout/revio-layout'

type NewWorkspaceComposerAgentSectionProps = Pick<
  NewWorkspaceComposerCardProps,
  | 'quickAgent'
  | 'agentSurfaceRows'
  | 'agentPickerDraft'
  | 'agentSetupDisabled'
  | 'selectedRepoIsGit'
  | 'selectedProjectId'
  | 'projectOptions'
  | 'onQuickAgentChange'
  | 'agentRows'
  | 'onOpenAgentSettings'
  | 'createDisabled'
  | 'onCreate'
  | 'advancedOpen'
  | 'onToggleAdvanced'
> & {
  advancedLocked?: boolean
  /** Prompt-first layout: agent picker and Advanced share one row, without the field label. */
  compact?: boolean
  /** The card opens its options from `···`, so its picker row has no Advanced. */
  hideAdvancedToggle?: boolean
  visibleQuickAgents: React.ComponentProps<typeof AgentCombobox>['agents']
  defaultTuiAgent: React.ComponentProps<typeof AgentCombobox>['defaultAgent']
  handleSetDefaultAgent: (
    next: Parameters<NonNullable<React.ComponentProps<typeof AgentCombobox>['onSetDefault']>>[0]
  ) => void
}

export function NewWorkspaceComposerAgentSection({
  quickAgent,
  agentSurfaceRows,
  agentPickerDraft,
  agentSetupDisabled,
  selectedRepoIsGit,
  selectedProjectId,
  projectOptions,
  onQuickAgentChange,
  onOpenAgentSettings,
  createDisabled,
  onCreate,
  advancedOpen,
  advancedLocked = false,
  compact = false,
  hideAdvancedToggle = false,
  onToggleAdvanced,
  defaultTuiAgent,
  handleSetDefaultAgent
}: NewWorkspaceComposerAgentSectionProps): React.JSX.Element {
  // A workspace-layout workspace opens on a chat, so it offers no blank terminal.
  const chatOnly = useRevioLayout()
  return (
    <>
      <div
        className={cn('min-w-0', compact ? 'flex items-center gap-2' : 'space-y-1')}
        data-contextual-tour-target="workspace-creation-agent"
      >
        <div className={cn('flex items-center justify-between gap-2', compact && 'sr-only')}>
          <label className="text-xs font-medium text-muted-foreground">
            {translate('components.newWorkspace.agentOptional', 'Agent [Optional]')}
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(event) => onOpenAgentSettings(event.currentTarget)}
                tabIndex={-1}
                className="size-5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={translate(
                  'auto.components.NewWorkspaceComposerCard.ab63f25397',
                  'Open agent settings'
                )}
              >
                <Settings2 className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {translate('auto.components.NewWorkspaceComposerCard.ba64270bdb', 'Configure agents')}
            </TooltipContent>
          </Tooltip>
        </div>
        <AgentLaunchPicker
          model={agentSurfaceRows?.model ?? { state: 'loading', placeholderCount: 2 }}
          agent={quickAgent}
          value={agentPickerDraft}
          cli={agentSurfaceRows?.selection.cli === true}
          setupDisabled={agentSetupDisabled}
          matchTriggerWidth={
            !compact &&
            selectedRepoIsGit &&
            projectOptions?.find((option) => option.id === selectedProjectId)?.kind !==
              'project-group'
          }
          onOpenAgentSettings={onOpenAgentSettings}
          onTriggerEnter={createDisabled ? undefined : onCreate}
          triggerVariant={hideAdvancedToggle ? 'ghost' : undefined}
          emptyLabel={
            chatOnly
              ? translate('auto.components.revioLayout.selectAgent', 'Select agent')
              : translate('auto.components.agent.AgentCombobox.986f946354', 'Blank Terminal')
          }
          defaultAgent={defaultTuiAgent}
          onSetDefault={handleSetDefaultAgent}
          onPick={(agent, draft, entry) => onQuickAgentChange(agent, draft?.surface, draft, entry)}
        >
          {chatOnly ? null : (
            <>
              <AgentDefaultContextMenu
                isDefault={defaultTuiAgent === 'blank'}
                onSetDefault={() => handleSetDefaultAgent('blank')}
              >
                <DropdownMenuItem onSelect={() => onQuickAgentChange(null)}>
                  <Terminal className="size-3.5" />
                  {translate('auto.components.agent.AgentCombobox.986f946354', 'Blank Terminal')}
                </DropdownMenuItem>
              </AgentDefaultContextMenu>
              <DropdownMenuSeparator />
            </>
          )}
        </AgentLaunchPicker>
        {compact && !hideAdvancedToggle ? (
          <div className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleAdvanced}
              disabled={advancedLocked}
              aria-expanded={advancedOpen}
            >
              {translate('auto.components.NewWorkspaceComposerCard.f0470c7383', 'Advanced')}
              <ChevronDown
                className={cn('size-4 transition-transform', advancedOpen && 'rotate-180')}
              />
            </Button>
          </div>
        ) : null}
      </div>

      <div className={cn('!mb-2', compact && 'hidden')}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleAdvanced}
          disabled={advancedLocked}
          aria-expanded={advancedOpen}
          className="-ml-2 text-xs focus-visible:ring-inset"
        >
          {translate('auto.components.NewWorkspaceComposerCard.f0470c7383', 'Advanced')}
          <ChevronDown
            className={cn('size-4 transition-transform', advancedOpen && 'rotate-180')}
          />
        </Button>
      </div>
    </>
  )
}
