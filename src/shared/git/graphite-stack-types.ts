/** One branch of a Graphite stack, as `gt state` reports it (Graphite stack support). */
export type GraphiteStackBranch = {
  name: string
  trunk: boolean
  needsRestack: boolean
  current: boolean
}

/** Newest branch first, ending at trunk; null when the workspace is not in a Graphite stack. */
export type GraphiteStack = { branches: GraphiteStackBranch[] } | null
