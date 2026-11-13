import React from 'react'
import { Check, FolderInput, Plus, Settings2, SquarePlus, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { moveWorkspaceToSection } from './revio-sidebar-sections'
import { openRevioSectionDialog } from './RevioSectionDialog'
import { createWorkspaceInSection } from './revio-create-in-section'

const NO_SECTIONS: readonly { id: string; name: string }[] = []

/** "Move to section ▸" in the workspace menu (with New section… and Manage). */
export function RevioMoveToSectionMenu({
  worktreeId,
  disabled
}: {
  worktreeId: string
  disabled: boolean
}): React.JSX.Element {
  const sections = useAppStore((s) => s.settings?.revioSidebarSections ?? NO_SECTIONS)
  const current = useAppStore((s) => s.settings?.revioWorkspaceSections?.[worktreeId] ?? null)
  const move = (sectionId: string | null): void => {
    const state = useAppStore.getState()
    void state.updateSettings({
      revioWorkspaceSections: moveWorkspaceToSection(
        state.settings?.revioWorkspaceSections,
        worktreeId,
        sectionId
      )
    })
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <FolderInput className="size-3.5" />
        {translate('auto.components.revioLayout.moveToSection', 'Move to section')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        {sections.map((section) => (
          <DropdownMenuItem key={section.id} onSelect={() => move(section.id)}>
            <span className="min-w-0 flex-1 truncate">{section.name}</span>
            {current === section.id ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
        {sections.length > 0 ? <DropdownMenuSeparator /> : null}
        {sections.map((section) => (
          <DropdownMenuItem
            key={`create:${section.id}`}
            onSelect={() => createWorkspaceInSection(section.id)}
          >
            <SquarePlus className="size-3.5" />
            <span className="min-w-0 flex-1 truncate">
              {translate(
                'auto.components.revioLayout.createInNamedSection',
                'Create in {{value0}}',
                {
                  value0: section.name
                }
              )}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => openRevioSectionDialog({ moveWorktreeId: worktreeId })}>
          <Plus className="size-3.5" />
          {translate('auto.components.revioLayout.createSection', 'Create section…')}
        </DropdownMenuItem>
        {current ? (
          <DropdownMenuItem onSelect={() => move(null)}>
            <X className="size-3.5" />
            {translate('auto.components.revioLayout.removeFromSection', 'Remove from section')}
          </DropdownMenuItem>
        ) : null}
        {sections.length > 0 ? (
          <DropdownMenuItem onSelect={() => openRevioSectionDialog({ manage: true })}>
            <Settings2 className="size-3.5" />
            {translate('auto.components.revioLayout.manageSections', 'Manage sections…')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
