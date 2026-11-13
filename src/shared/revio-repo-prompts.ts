import type { RevioPrompts } from './revio-layout-settings-types'

/** A repository's own prompts win; blank ones fall back to the global prompts. */
export function mergeRevioPrompts(
  global: RevioPrompts | undefined,
  repo: RevioPrompts | undefined
): RevioPrompts {
  const merged: RevioPrompts = { ...global }
  for (const [id, text] of Object.entries(repo ?? {})) {
    if (typeof text === 'string' && text.trim()) {
      Reflect.set(merged, id, text)
    }
  }
  return merged
}

/** Sets a repository's General preferences; blank text removes them so the global ones apply. */
export function withRepoGeneralPreferences(
  current: Readonly<Record<string, string>> | undefined,
  repoId: string,
  text: string
): Record<string, string> {
  const others = Object.fromEntries(Object.entries(current ?? {}).filter(([id]) => id !== repoId))
  return text.trim() ? { ...others, [repoId]: text.trim() } : others
}
