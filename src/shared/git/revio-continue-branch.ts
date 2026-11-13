/** What Continue did: the new branch, and the remote branch it starts from (e.g. origin/main). */
export type ContinueOnNewBranchResult = { branch: string; base: string }

const MAX_SUFFIX = 50

/**
 * The new branch after a merged PR: the old name with the next free number ("feat" → "feat-2",
 * "feat-2" → "feat-3"). null when every candidate up to MAX_SUFFIX is taken.
 */
export function nextContinueBranchName(
  current: string,
  exists: (name: string) => boolean
): string | null {
  const match = /^(.*?)-(\d+)$/.exec(current)
  const stem = match?.[1] || current
  const start = match ? Number(match[2]) + 1 : 2
  for (let suffix = start; suffix < start + MAX_SUFFIX; suffix++) {
    const name = `${stem}-${suffix}`
    if (!exists(name)) {
      return name
    }
  }
  return null
}
