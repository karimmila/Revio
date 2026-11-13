export type BoundedRetryOptions = {
  /** Wait before each attempt; the chain ends after the last one. */
  delaysMs: readonly number[]
  attempt: () => void
  /** Checked before each attempt; true ends the chain early. */
  isDone: () => boolean
}

/** One timer at a time, a fixed number of attempts, and a cancel; never a burst of timers. */
export function startBoundedRetry(options: BoundedRetryOptions): () => void {
  let index = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false
  const next = (): void => {
    if (cancelled || index >= options.delaysMs.length) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      if (cancelled || options.isDone()) {
        return
      }
      options.attempt()
      next()
    }, options.delaysMs[index++])
  }
  next()
  return () => {
    cancelled = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}
