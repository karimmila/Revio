import { gitExecFileAsync } from '../runner'

/**
 * Graphite keeps each tracked branch's parent in `refs/branch-metadata/<branch>`, a blob of JSON
 * with `parentBranchName`. This turns those blobs into the `gt state` shape buildGraphiteStack
 * reads, so a stack shows without the gt CLI. A parent with no metadata of its own is trunk.
 */
export function graphiteStateFromMetadata(entries: ReadonlyMap<string, string>): string {
  const state: Record<string, { trunk?: boolean; parents?: { ref: string }[] }> = {}
  for (const [branch, blob] of entries) {
    let parent: unknown
    try {
      const parsed: unknown = JSON.parse(blob)
      parent =
        parsed && typeof parsed === 'object' && 'parentBranchName' in parsed
          ? parsed.parentBranchName
          : undefined
    } catch {
      continue
    }
    if (typeof parent !== 'string' || !parent) {
      continue
    }
    state[branch] = { parents: [{ ref: parent }] }
    if (!entries.has(parent)) {
      state[parent] = { trunk: true }
    }
  }
  return JSON.stringify(state)
}

const PREFIX = 'refs/branch-metadata/'

/** Reads every branch's Graphite metadata from git (no gt); empty when the repo has none. */
export async function readGraphiteMetadataState(worktreePath: string): Promise<string> {
  const { stdout } = await gitExecFileAsync(
    ['for-each-ref', '--format=%(refname) %(objectname)', PREFIX],
    { cwd: worktreePath }
  )
  const refs = stdout
    .split('\n')
    .map((line) => line.trim().split(' '))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[1]))
  const entries = new Map<string, string>()
  for (const [ref, oid] of refs.slice(0, 500)) {
    const { stdout: blob } = await gitExecFileAsync(['cat-file', 'blob', oid], {
      cwd: worktreePath
    })
    entries.set(ref.slice(PREFIX.length), blob)
  }
  return graphiteStateFromMetadata(entries)
}
