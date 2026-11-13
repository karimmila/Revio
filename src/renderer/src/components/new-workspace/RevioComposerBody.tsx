import React from 'react'
import { Cloud, CornerDownLeft, LoaderCircle, MoreHorizontal, Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import ProjectCombobox from '@/components/new-workspace/ProjectCombobox'
import { getSelectedNewWorkspaceProjectOptionId } from '@/lib/new-workspace-project-options'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import { WorkspacePromptInput } from './WorkspacePromptInput'
import { NewWorkspaceComposerAgentSection } from './NewWorkspaceComposerAgentSection'
import { NewWorkspaceComposerAdvancedSection } from './NewWorkspaceComposerAdvancedSection'
import { NewWorkspaceComposerNameSection } from './NewWorkspaceComposerNameSection'
import { CloudCreateReadiness } from './CloudCreateReadiness'
import { NativeChatSessionOptionPickers } from '@/components/native-chat/NativeChatSessionOptionPickers'
import { NativeChatComposerPermissionPicker } from '@/components/native-chat/NativeChatPermissionModePicker'
import { useClaudeLoginRoute } from '@/lib/claude-login-route-store'
import type { ClaudeLoginRoute } from '../../../../shared/claude-login-route'

type AgentSectionProps = React.ComponentProps<typeof NewWorkspaceComposerAgentSection>

/** Card-owned state the sections need beyond the composer props. */
export type RevioComposerSections = {
  visibleQuickAgents: AgentSectionProps['visibleQuickAgents']
  defaultTuiAgent: AgentSectionProps['defaultTuiAgent']
  handleSetDefaultAgent: AgentSectionProps['handleSetDefaultAgent']
  handleNamePlainEnter: () => void
  sparseEditing: boolean
  setSparseEditing: (editing: boolean) => void
  branchNameInputId: string
  showSetupAgentStartupPolicy: boolean
}

/** Why the model pill cannot be opened yet; undefined when it can. */
export function composerModelReason(
  agent: string | null | undefined,
  claudeRoute: ClaudeLoginRoute | null
): string | undefined {
  return agent === 'claude' && claudeRoute === 'none'
    ? translate(
        'auto.components.revioLayout.modelNeedsClaudeSignIn',
        'Sign in to Claude to choose a model'
      )
    : undefined
}

/**
 * The create card: project chip and `···` in a header row, a borderless prompt, then the
 * agent picker, attach and Create. Everything else Orca offers stays one press away under `···`.
 */
export function RevioComposerBody({
  card,
  onAddProject,
  focusNameInput,
  sections
}: {
  card: NewWorkspaceComposerCardProps
  onAddProject: () => void
  focusNameInput: () => void
  sections: RevioComposerSections
}): React.JSX.Element {
  const cloudLocation = useAppStore((s) => s.settings?.revioLocation === 'cloud')
  // Models are listed with this Mac's Claude login, so the pill is disabled until there is one.
  const modelReason = composerModelReason(card.quickAgent, useClaudeLoginRoute())
  const { advancedOpen, onToggleAdvanced } = card
  React.useEffect(() => {
    // ⌘I "Create from": the PR, branch and issue picker sits in this card's options.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey && !event.shiftKey && !event.altKey && event.code === 'KeyI') {
        event.preventDefault()
        if (!advancedOpen) {
          onToggleAdvanced()
        }
        requestAnimationFrame(() => {
          focusNameInput()
          // The picker opens on Pull requests; the tab's own press opens its results.
          document
            .querySelector('[data-create-from-tab="github:pr"]')
            ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        })
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [advancedOpen, onToggleAdvanced, focusNameInput])
  const projectOptions = card.projectOptions ?? []
  // The closed combobox shows the project name as its input's placeholder, so size it from that.
  const selectedName =
    projectOptions.find((option) => option.id === card.selectedProjectId)?.displayName ?? ''
  const chipWidthCh = Math.min(28, Math.max(6, selectedName.length + 1))
  const chipStyle: React.CSSProperties & { '--chip-input-width': string } = {
    '--chip-input-width': `${chipWidthCh}ch`
  }
  const agentPicker = (
    <NewWorkspaceComposerAgentSection
      {...card}
      createDisabled={card.createDisabled || sections.sparseEditing}
      advancedLocked={sections.sparseEditing}
      visibleQuickAgents={sections.visibleQuickAgents}
      defaultTuiAgent={sections.defaultTuiAgent}
      handleSetDefaultAgent={sections.handleSetDefaultAgent}
      compact
      hideAdvancedToggle
    />
  )
  const optionsPanel = (
    <>
      <NewWorkspaceComposerNameSection {...card} onNamePlainEnter={sections.handleNamePlainEnter} />
      <NewWorkspaceComposerAdvancedSection
        {...card}
        onSparseEditingChange={sections.setSparseEditing}
        sparseEditing={sections.sparseEditing}
        branchNameInputId={sections.branchNameInputId}
        showSetupAgentStartupPolicy={sections.showSetupAgentStartupPolicy}
      />
    </>
  )
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-input px-2">
        <div className="w-fit min-w-0 max-w-[60%]" style={chipStyle}>
          <ProjectCombobox
            options={projectOptions}
            value={getSelectedNewWorkspaceProjectOptionId(
              projectOptions,
              card.selectedProjectId ?? null,
              card.selectedProjectHostSetupId,
              card.selectedRepoExecutionHostId
            )}
            onValueChange={card.onProjectChange}
            onValueSelected={focusNameInput}
            onAddProject={onAddProject}
            placeholder={translate(
              'auto.components.NewWorkspaceComposerCard.dccd26d4e4',
              'Choose project'
            )}
            triggerClassName="h-7 w-auto gap-1.5 border-transparent bg-transparent px-1.5 text-[12.5px] font-medium shadow-none hover:bg-accent dark:bg-transparent [&_input]:w-(--chip-input-width) [&_input]:flex-none"
            invalid={Boolean(card.projectError)}
          />
        </div>
        <button
          type="button"
          onClick={card.onToggleAdvanced}
          aria-expanded={card.advancedOpen}
          aria-label={translate('auto.components.revioLayout.moreOptions', 'More options')}
          className={cn(
            'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            card.advancedOpen && 'bg-accent text-foreground'
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
        {cloudLocation ? (
          <span
            data-revio-cloud-chip=""
            title={translate(
              'auto.components.revioLayout.cloudChipTitle',
              'This workspace runs in a Vercel Sandbox. Switch with ⌃1 / ⌃2.'
            )}
            className="ml-auto flex h-6 items-center gap-1 rounded-md bg-accent px-2 text-[12px] text-muted-foreground"
          >
            <Cloud className="size-3" />
            {translate('auto.components.revioLayout.cloudLocation', 'Cloud')}
          </span>
        ) : null}
      </div>
      {cloudLocation && card.repoId ? <CloudCreateReadiness repoId={card.repoId} /> : null}
      {card.advancedOpen ? (
        <div className="max-h-[45vh] shrink-0 space-y-4 overflow-y-auto border-b border-input px-3 py-3 scrollbar-sleek">
          {optionsPanel}
        </div>
      ) : null}
      <WorkspacePromptInput
        variant="bare"
        value={card.agentPrompt ?? ''}
        onChange={card.onAgentPromptChange ?? (() => undefined)}
        onSubmit={card.createDisabled ? undefined : card.onCreate}
      />
      {card.createError ? (
        <p role="alert" className="px-3.5 pb-1 text-xs text-destructive">
          {card.createError.message}
        </p>
      ) : null}
      <div className="flex shrink-0 items-center gap-2 px-2.5 pb-2.5">
        <div className="min-w-0">{agentPicker}</div>
        {card.quickAgent && card.chatOptions ? (
          <div
            className="min-w-0"
            data-revio-composer-model=""
            data-model-reason={modelReason ? '' : undefined}
            title={modelReason}
          >
            <NativeChatSessionOptionPickers
              surface={card.chatOptions.surface}
              snapshot={card.chatOptions.snapshot}
              isWorking={false}
            />
          </div>
        ) : null}
        {card.quickAgent && card.chatOptions ? (
          <NativeChatComposerPermissionPicker
            surface={card.chatOptions.surface}
            snapshot={card.chatOptions.snapshot}
            agent={card.quickAgent}
          />
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {card.onAddAttachment ? (
            <button
              type="button"
              onClick={card.onAddAttachment}
              aria-label={translate('auto.components.revioLayout.attach', 'Attach files')}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void card.onCreate()}
            disabled={card.createDisabled}
            className="flex h-[22px] items-center gap-1 rounded-[5px] bg-foreground px-2 text-[11.5px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {card.creating ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {translate('auto.components.NewWorkspaceComposerModal.create', 'Create')}
            <CornerDownLeft className="size-3 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  )
}
