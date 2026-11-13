import type { SetupStatus } from '../../shared/setup-status'

/** A worktree whose status file has not appeared yet keeps being checked this long (setup starts late). */
export const SETUP_STATUS_NEW_WORKTREE_MS = 3 * 60_000
export const SETUP_STATUS_POLL_MS = 2_000

export type SetupStatusReading = { status: SetupStatus; runId: string } | null

export type SetupStatusEvent =
  | { kind: 'changed'; path: string; status: SetupStatus | null }
  | { kind: 'finished'; path: string; status: 'succeeded' | 'failed'; runId: string }

type MonitorDeps = {
  read: (path: string) => SetupStatusReading
  emit: (event: SetupStatusEvent) => void
  now?: () => number
}

/**
 * One poll of setup status files for the whole app, shared by every window. Windows tell it
 * which worktrees they show; it emits changes and finishes once, and grants each finished
 * setup run's follow-up (Auto-run after setup, the failure toast) to exactly one window.
 */
export class SetupStatusMonitor {
  private readonly readings = new Map<string, SetupStatusReading>()
  private readonly firstSeen = new Map<string, number>()
  private readonly watchers = new Map<number, Set<string>>()
  private readonly claimed = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly now: () => number

  constructor(private readonly deps: MonitorDeps) {
    this.now = deps.now ?? Date.now
  }

  /** Replaces a window's watched paths and returns what is known for them right now. */
  watch(watcherId: number, paths: readonly string[]): Record<string, SetupStatus | null> {
    this.watchers.set(watcherId, new Set(paths))
    this.tick()
    return Object.fromEntries(paths.map((path) => [path, this.readings.get(path)?.status ?? null]))
  }

  unwatch(watcherId: number): void {
    this.watchers.delete(watcherId)
    this.syncTimer()
  }

  /** True for the first caller per finished run, so two windows never both act on it. */
  claim(path: string, runId: string): boolean {
    const key = `${path}\u0000${runId}`
    if (this.claimed.has(key)) {
      return false
    }
    this.claimed.add(key)
    return true
  }

  tick(): void {
    const now = this.now()
    for (const path of this.pathsToPoll(now)) {
      if (!this.firstSeen.has(path)) {
        this.firstSeen.set(path, now)
      }
      const known = this.readings.has(path)
      const previous = this.readings.get(path) ?? null
      const next = this.deps.read(path)
      this.readings.set(path, next)
      if (known && previous?.status === next?.status && previous?.runId === next?.runId) {
        continue
      }
      if (!known || previous?.status !== next?.status) {
        this.deps.emit({ kind: 'changed', path, status: next?.status ?? null })
      }
      if (previous?.status === 'running' && next && next.status !== 'running') {
        this.deps.emit({ kind: 'finished', path, status: next.status, runId: next.runId })
      }
    }
    this.syncTimer()
  }

  private watchedPaths(): Set<string> {
    const all = new Set<string>()
    for (const paths of this.watchers.values()) {
      for (const path of paths) {
        all.add(path)
      }
    }
    return all
  }

  /** Never read, running, or new and still without a status; finished setups are not re-read. */
  private pathsToPoll(now: number): string[] {
    return [...this.watchedPaths()].filter((path) => {
      if (!this.readings.has(path)) {
        return true
      }
      const reading = this.readings.get(path)
      if (reading?.status === 'running') {
        return true
      }
      return (
        reading === null && now - (this.firstSeen.get(path) ?? now) < SETUP_STATUS_NEW_WORKTREE_MS
      )
    })
  }

  private syncTimer(): void {
    const needed = this.pathsToPoll(this.now()).length > 0
    if (needed && this.timer === null) {
      this.timer = setInterval(() => this.tick(), SETUP_STATUS_POLL_MS)
      this.timer.unref?.()
    } else if (!needed && this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
