import {
  QUIT_RENDERER_ACK_TIMEOUT_MS,
  WILL_QUIT_TEARDOWN_DEADLINE_MS
} from '../../shared/quit-teardown-deadline'

export type ProcessQuitEscalationDeps = {
  /** Marks the quit as one nobody can be asked about. */
  markRequested: () => void
  /** Closes the "terminals are running a program" question when it is open. */
  closeQuitQuestion: () => void
  quit: () => void
  /** True once `will-quit` began the teardown that stops sessions and the terminal service. */
  teardownStarted: () => boolean
  /** Closes every window past its close handlers, so a stalled window cannot hold `will-quit`. */
  destroyWindows: () => void
  /** The terminal-service half of the teardown, for a quit that never reached `will-quit`. */
  stopTerminalService: () => Promise<unknown>
  exit: () => void
}

export type ProcessQuitEscalationTiming = {
  /** How long the ordinary quit gets to reach `will-quit`. */
  stalledQuitMs: number
  /** How long the quit gets to reach `will-quit` once its windows were destroyed. */
  windowlessQuitMs: number
  /** How long the terminal service gets to stop when the app must stop it directly. */
  terminalServiceStopMs: number
  /** How long a started teardown gets before the process exits anyway. */
  teardownMs: number
}

export const PROCESS_QUIT_ESCALATION_TIMING: ProcessQuitEscalationTiming = {
  // A window may take the whole renderer acknowledgement time before it lets the quit through.
  stalledQuitMs: QUIT_RENDERER_ACK_TIMEOUT_MS + 2_000,
  windowlessQuitMs: 3_000,
  terminalServiceStopMs: 5_000,
  teardownMs: WILL_QUIT_TEARDOWN_DEADLINE_MS + 2_000
}

function later(run: () => void, ms: number): void {
  setTimeout(run, ms).unref?.()
}

/**
 * The handler for SIGTERM, SIGINT and SIGHUP. A signal has nobody to answer a question and must
 * end the whole app, so it closes the quit question, asks for the same quit a confirmed Quit
 * runs, and then makes sure that quit ends: a quit that does not reach `will-quit` loses its
 * windows, and one that still does not gets the terminal service stopped and the process exited.
 * Every step is bounded, so no dialog, window or stuck service can keep the process alive.
 */
export function createProcessQuitEscalation(
  deps: ProcessQuitEscalationDeps,
  timing: ProcessQuitEscalationTiming = PROCESS_QUIT_ESCALATION_TIMING
): () => void {
  let armed = false

  const exitAfterTeardown = (): void => later(deps.exit, timing.teardownMs)

  const stopDirectly = (): void => {
    if (deps.teardownStarted()) {
      exitAfterTeardown()
      return
    }
    let exited = false
    const exitOnce = (): void => {
      if (!exited) {
        exited = true
        deps.exit()
      }
    }
    later(exitOnce, timing.terminalServiceStopMs)
    void Promise.resolve()
      .then(() => deps.stopTerminalService())
      .catch(() => undefined)
      .then(exitOnce)
  }

  const escalate = (): void => {
    if (deps.teardownStarted()) {
      exitAfterTeardown()
      return
    }
    deps.destroyWindows()
    deps.quit()
    later(stopDirectly, timing.windowlessQuitMs)
  }

  return () => {
    deps.markRequested()
    deps.closeQuitQuestion()
    // Every signal asks again: a window may have vetoed the quit the earlier one asked for.
    deps.quit()
    if (!armed) {
      armed = true
      later(escalate, timing.stalledQuitMs)
    }
  }
}
