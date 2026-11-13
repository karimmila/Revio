import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import { moveWorkspaceToSection } from './revio-sidebar-sections'

// A creation waits this long for its workspace before the section request lapses.
const PENDING_MS = 10 * 60_000

let pending: { sectionId: string; since: number; known: ReadonlySet<string> } | null = null

/** The workspace ids new since `known`, for the creation that is waiting on one. */
export function newWorktreeIds(known: ReadonlySet<string>, current: readonly string[]): string[] {
  return current.filter((id) => !known.has(id))
}

function allWorktreeIds(): string[] {
  return Object.values(selectWorktreesByRepo(useAppStore.getState()))
    .flat()
    .map((worktree) => worktree.id)
}

/** "Create in section": the next workspace created lands in this section. */
export function createWorkspaceInSection(sectionId: string): void {
  pending = { sectionId, since: Date.now(), known: new Set(allWorktreeIds()) }
  openWorkspaceCreationComposerWithTourHandoff()
}

/** Assigns the first workspace created after "Create in section" to that section. */
export function useCreateInSection(): void {
  // Store changes are frequent; only a waiting creation pays for the worktree scan.
  useEffect(
    () =>
      useAppStore.subscribe(() => {
        const request = pending
        if (!request) {
          return
        }
        if (Date.now() - request.since > PENDING_MS) {
          pending = null
          return
        }
        const added = newWorktreeIds(request.known, allWorktreeIds())
        if (added.length === 0) {
          return
        }
        pending = null
        const state = useAppStore.getState()
        void state.updateSettings({
          revioWorkspaceSections: moveWorkspaceToSection(
            state.settings?.revioWorkspaceSections,
            added[0]!,
            request.sectionId
          )
        })
      }),
    []
  )
}
