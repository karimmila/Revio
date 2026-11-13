import type React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'

/** Folder workspaces keep the classic form: their submit path has no prompt destination. */
export function isPromptFirstComposer(
  settings: Pick<GlobalSettings, 'promptFirstWorkspaceComposer'> | null | undefined,
  card: Pick<NewWorkspaceComposerCardProps, 'projectOptions' | 'selectedProjectId'>
): boolean {
  const selected = card.projectOptions?.find((option) => option.id === card.selectedProjectId)
  return settings?.promptFirstWorkspaceComposer === true && selected?.kind !== 'project-group'
}

export function WorkspacePromptInput({
  value,
  onChange,
  onSubmit,
  variant = 'boxed'
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  /** `bare` drops the border for the create card, whose card is the frame. */
  variant?: 'boxed' | 'bare'
}): React.JSX.Element {
  return (
    <textarea
      data-workspace-prompt-input="true"
      aria-label={translate(
        'auto.components.NewWorkspaceComposerModal.promptLabel',
        'What do you want to work on?'
      )}
      placeholder={translate(
        'auto.components.NewWorkspaceComposerModal.promptLabel',
        'What do you want to work on?'
      )}
      value={value}
      rows={4}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        // Enter creates and Shift+Enter breaks the line, as in a chat composer.
        if (
          event.key !== 'Enter' ||
          event.shiftKey ||
          event.altKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.nativeEvent.isComposing
        ) {
          return
        }
        event.preventDefault()
        onSubmit?.()
      }}
      className={
        variant === 'bare'
          ? 'block min-h-[150px] w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground'
          : 'block min-h-24 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
      }
    />
  )
}

/**
 * Create dialog frame. The card is 842pt wide on a 1.2x Orca (702 CSS px), edge to edge
 * when narrower, its top at 50% minus 228 CSS px, with no close button.
 */
export function useComposerDialogFrame(): {
  className: string
  showCloseButton: boolean
  overlayClassName: string | undefined
} {
  const layoutOn = useAppStore(
    (s) => s.settings?.revioLayout === true && s.settings?.promptFirstWorkspaceComposer === true
  )
  return layoutOn
    ? {
        className:
          'top-[max(4px,calc(50%-228px))] flex max-h-[calc(100vh-8px)] w-[calc(100vw-2px)] max-w-[702px] translate-y-0 flex-col gap-0 overflow-hidden rounded-[10px] p-0 sm:max-w-[702px]',
        showCloseButton: false,
        overlayClassName: 'bg-black/55 backdrop-blur-[6px]'
      }
    : {
        className: 'flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-lg',
        showCloseButton: true,
        overlayClassName: undefined
      }
}
