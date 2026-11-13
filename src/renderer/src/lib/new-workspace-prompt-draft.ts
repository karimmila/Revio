import { useEffect, useRef } from 'react'

export type ComposerLocation = 'mac' | 'cloud'

const STORAGE_KEY = 'orca.newWorkspacePromptDrafts'

// Why not the chat composer's draft store: its scopes belong to chat tabs and workspaces, and
// its owner pruning would drop a draft that has neither.
const drafts = new Map<ComposerLocation, string>()
let loaded = false
// The location whose draft the Create in flight was made from; cleared once it succeeds.
let submittedLocation: ComposerLocation | null = null

function load(): void {
  if (loaded) {
    return
  }
  loaded = true
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (stored && typeof stored === 'object') {
      if ('mac' in stored && typeof stored.mac === 'string' && stored.mac) {
        drafts.set('mac', stored.mac)
      }
      if ('cloud' in stored && typeof stored.cloud === 'string' && stored.cloud) {
        drafts.set('cloud', stored.cloud)
      }
    }
  } catch {
    // Unreadable storage leaves the drafts in memory only.
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(drafts)))
  } catch {
    // Full or blocked storage keeps the drafts for this run only.
  }
}

export function readNewWorkspacePromptDraft(location: ComposerLocation): string {
  load()
  return drafts.get(location) ?? ''
}

export function writeNewWorkspacePromptDraft(location: ComposerLocation, text: string): void {
  load()
  if ((drafts.get(location) ?? '') === text) {
    return
  }
  if (text) {
    drafts.set(location, text)
  } else {
    drafts.delete(location)
  }
  save()
}

export function resetNewWorkspacePromptDraftsForTests(): void {
  drafts.clear()
  loaded = false
  submittedLocation = null
}

export function markNewWorkspacePromptDraftSubmitted(location: ComposerLocation): void {
  submittedLocation = location
}

export function clearSubmittedNewWorkspacePromptDraft(): void {
  if (submittedLocation) {
    writeNewWorkspacePromptDraft(submittedLocation, '')
    submittedLocation = null
  }
}

/**
 * Keeps the Create dialog's prompt as one draft per location, like the composer: closing
 * the dialog keeps it, switching Mac/Cloud swaps to that location's draft, and only a created
 * workspace clears it.
 */
export function useNewWorkspacePromptDraft(
  location: ComposerLocation,
  prompt: string,
  setPrompt: ((text: string) => void) | undefined
): void {
  const shown = useRef(location)
  useEffect(() => {
    if (shown.current !== location) {
      shown.current = location
      setPrompt?.(readNewWorkspacePromptDraft(location))
      return
    }
    writeNewWorkspacePromptDraft(location, prompt)
  }, [location, prompt, setPrompt])
}
