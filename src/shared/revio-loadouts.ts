// The loadouts: up to five saved agent + model + effort sets, picked with ⌘⌃1…5.

export type RevioLoadout = {
  id: string
  agent: string
  model: string
  effort?: string
  /** What the picker shows, e.g. "Opus 4.6 · High". */
  label: string
}

export const MAX_LOADOUTS = 5

function sameSet(a: RevioLoadout, b: Omit<RevioLoadout, 'id' | 'label'>): boolean {
  return a.agent === b.agent && a.model === b.model && (a.effort ?? '') === (b.effort ?? '')
}

/** Adds a loadout unless the same set is saved or all five slots are taken. */
export function addLoadout(
  loadouts: readonly RevioLoadout[],
  next: RevioLoadout
): RevioLoadout[] | 'exists' | 'full' {
  if (loadouts.some((loadout) => sameSet(loadout, next))) {
    return 'exists'
  }
  return loadouts.length >= MAX_LOADOUTS ? 'full' : [...loadouts, next]
}

export function removeLoadout(loadouts: readonly RevioLoadout[], id: string): RevioLoadout[] {
  return loadouts.filter((loadout) => loadout.id !== id)
}

/** A loadout applies to the chat in place when that chat's model list offers its model; another
 * agent's loadout opens a new chat instead. */
export function loadoutFitsChat(
  loadout: RevioLoadout,
  modelChoices: readonly string[] | null
): boolean {
  return modelChoices !== null && modelChoices.includes(loadout.model)
}
