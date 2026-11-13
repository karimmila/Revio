import React from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { deleteSection, moveWorkspaceToSection } from './revio-sidebar-sections'
import { createWorkspaceInSection, useCreateInSection } from './revio-create-in-section'
import { useRevioSectionDrop } from './use-revio-section-drop'

type Request = { moveWorktreeId?: string; manage?: boolean }

let request: Request | null = null
const listeners = new Set<() => void>()

function setRequest(next: Request | null): void {
  request = next
  for (const listener of listeners) {
    listener()
  }
}

/** Opens Create section (optionally moving a workspace into it) or Manage sections. */
export function openRevioSectionDialog(next: Request): void {
  setRequest(next)
}

function useRequest(): Request | null {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => request
  )
}

function newSectionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Moves one section up or down; returns the same list at either end. */
export function reorderSection<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) {
    return [...list]
  }
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  return next
}

function CreateSection({ moveWorktreeId }: { moveWorktreeId?: string }): React.JSX.Element {
  const [name, setName] = React.useState('')
  const create = (): void => {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    const state = useAppStore.getState()
    const id = newSectionId()
    void state.updateSettings({
      revioSidebarSections: [
        ...(state.settings?.revioSidebarSections ?? []),
        { id, name: trimmed }
      ],
      ...(moveWorktreeId
        ? {
            revioWorkspaceSections: moveWorkspaceToSection(
              state.settings?.revioWorkspaceSections,
              moveWorktreeId,
              id
            )
          }
        : {})
    })
    setRequest(null)
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.revioLayout.createSectionTitle', 'Create section')}
        </DialogTitle>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        placeholder={translate('auto.components.revioLayout.sectionName', 'Section name')}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            create()
          }
        }}
      />
      <DialogFooter>
        <Button type="button" disabled={!name.trim()} onClick={create}>
          {translate('auto.components.revioLayout.createSectionButton', 'Create')}
        </Button>
      </DialogFooter>
    </>
  )
}

function ManageSections(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const update = useAppStore((s) => s.updateSettings)
  const sections = settings?.revioSidebarSections ?? []
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.revioLayout.manageSectionsTitle', 'Sections')}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        {sections.map((section, index) => (
          <div key={section.id} className="flex items-center gap-1">
            <Input
              defaultValue={section.name}
              aria-label={translate('auto.components.revioLayout.sectionName', 'Section name')}
              onBlur={(event) => {
                const name = event.target.value.trim()
                if (name && name !== section.name) {
                  void update({
                    revioSidebarSections: sections.map((candidate) =>
                      candidate.id === section.id ? { ...candidate, name } : candidate
                    )
                  })
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate(
                'auto.components.revioLayout.createInSection',
                'Create in section'
              )}
              onClick={() => {
                setRequest(null)
                createWorkspaceInSection(section.id)
              }}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('auto.components.revioLayout.moveSectionUp', 'Move up')}
              onClick={() =>
                void update({ revioSidebarSections: reorderSection(sections, index, -1) })
              }
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('auto.components.revioLayout.moveSectionDown', 'Move down')}
              onClick={() =>
                void update({ revioSidebarSections: reorderSection(sections, index, 1) })
              }
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('auto.components.revioLayout.deleteSection', 'Delete section')}
              onClick={() => settings && void update(deleteSection(settings, section.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </>
  )
}

/** Mounted once in the workspace layout: Create section / Manage sections on request, plus section
 * drag-and-drop and Create in section. */
export function RevioSectionDialog(): React.JSX.Element {
  useRevioSectionDrop()
  useCreateInSection()
  const current = useRequest()
  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && setRequest(null)}>
      <DialogContent className="max-w-sm sm:max-w-sm">
        {current?.manage ? (
          <ManageSections />
        ) : current ? (
          <CreateSection moveWorktreeId={current.moveWorktreeId} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
