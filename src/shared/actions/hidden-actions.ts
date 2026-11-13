/** The key an action's "Hide action" is stored under: per repository, per action id. */
export function hiddenActionKey(repoId: string, actionId: string): string {
  return `${repoId}\n${actionId}`
}

/** Settings after toggling one action's visibility in the Run menu (Show / Hide action). */
export function toggleHiddenAction(
  hidden: readonly string[] | undefined,
  repoId: string,
  actionId: string
): string[] {
  const key = hiddenActionKey(repoId, actionId)
  const current = hidden ?? []
  return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
}

export function isActionHidden(
  hidden: readonly string[] | undefined,
  repoId: string,
  actionId: string
): boolean {
  return (hidden ?? []).includes(hiddenActionKey(repoId, actionId))
}
