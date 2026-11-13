import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { translateMain } from '../i18n/main-i18n'

/**
 * The workspace layout quits like any Mac app: Quit ends the terminal service and its shells, so
 * nothing of the app keeps running. "Keep terminals running after quit" (Advanced) brings back
 * the classic behaviour, where they stay for the next launch. An update restart always keeps
 * them, and a serve host has no Quit of this kind.
 */
export function stopsTerminalsOnQuit(
  settings: Pick<GlobalSettings, 'revioLayout' | 'revioKeepTerminalsAfterQuit'> | undefined,
  context: { isServeMode: boolean; quittingForUpdate: boolean }
): boolean {
  return (
    settings?.revioLayout === true &&
    settings.revioKeepTerminalsAfterQuit !== true &&
    !context.isServeMode &&
    !context.quittingForUpdate
  )
}

export type BusyTerminal = { id: string; rootProcessId?: number }

export type BusyTerminalSource = {
  listProcesses: () => Promise<readonly BusyTerminal[]>
  hasChildProcesses: (id: string) => Promise<boolean>
}

/**
 * Terminals with a program in the foreground (an agent, a server, an editor), which quitting
 * would end. `ownTerminalIds` names the busy ones whose program is the app's own (a cloud
 * workspace's dock session), which the person never started and is not asked about. Zero when
 * the service cannot say in time: an unanswered question must not hold Quit.
 */
export async function countBusyTerminals(
  source: BusyTerminalSource | null,
  timeoutMs: number,
  ownTerminalIds?: (busy: readonly BusyTerminal[]) => Promise<ReadonlySet<string>>
): Promise<number> {
  if (!source) {
    return 0
  }
  const count = (async (): Promise<number> => {
    const processes = await source.listProcesses()
    const flags = await Promise.all(
      processes.map((process) => source.hasChildProcesses(process.id).catch(() => false))
    )
    const busy = processes.filter((_process, index) => flags[index])
    if (busy.length === 0 || !ownTerminalIds) {
      return busy.length
    }
    const own = await ownTerminalIds(busy).catch(() => new Set<string>())
    return busy.filter((process) => !own.has(process.id)).length
  })().catch(() => 0)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<number>((resolve) => {
    timer = setTimeout(() => resolve(0), timeoutMs)
  })
  try {
    return await Promise.race([count, timedOut])
  } finally {
    clearTimeout(timer)
  }
}

const QUIT_BUTTON_INDEX = 0
const CANCEL_BUTTON_INDEX = 1

/**
 * Asks before a Quit that would end running programs; resolves true to quit. Aborting `signal`
 * closes the question as if the person chose Cancel.
 */
export async function confirmQuitWithBusyTerminals(
  busy: number,
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>,
  signal?: AbortSignal
): Promise<boolean> {
  const { response } = await showMessageBox({
    ...(signal ? { signal } : {}),
    type: 'warning',
    buttons: [
      translateMain('quitBusyTerminals.quit', 'Quit'),
      translateMain('quitBusyTerminals.cancel', 'Cancel')
    ],
    defaultId: QUIT_BUTTON_INDEX,
    cancelId: CANCEL_BUTTON_INDEX,
    noLink: true,
    message:
      busy === 1
        ? translateMain('quitBusyTerminals.messageOne', '1 terminal is running a program')
        : translateMain('quitBusyTerminals.message', '{{count}} terminals are running a program', {
            count: busy
          }),
    detail: translateMain(
      'quitBusyTerminals.detail',
      'Quitting {{productName}} stops them. To keep terminals running after quit, turn that on in Settings › Advanced.'
    )
  })
  return response === QUIT_BUTTON_INDEX
}

export type QuitTerminalGuardDeps = {
  /** False when this quit keeps terminals, or was asked for by a signal, logout or shutdown. */
  shouldAsk: () => boolean
  countBusy: () => Promise<number>
  confirm: (busy: number) => Promise<boolean>
  quit: () => void
  /** The person chose Cancel: the app goes on as before the Quit. */
  cancelled?: () => void
}

/**
 * The `before-quit` listener. It holds the first Quit while it counts and, when a terminal is
 * busy, asks; a confirmed Quit and every later pass go straight through. A signal, logout or
 * shutdown that arrives while it counts or asks overtakes the question: the quit goes on as if
 * confirmed, whatever the closed dialog answered.
 */
export function createQuitTerminalGuard(
  deps: QuitTerminalGuardDeps
): (event: { preventDefault: () => void; defaultPrevented?: boolean }) => void {
  let allowed = false
  let asking = false
  return (event) => {
    if (allowed || event.defaultPrevented || !deps.shouldAsk()) {
      return
    }
    event.preventDefault()
    if (asking) {
      return
    }
    asking = true
    void deps
      .countBusy()
      .then((busy) => (busy > 0 && deps.shouldAsk() ? deps.confirm(busy) : true))
      // A dialog that cannot show must not make the app impossible to quit.
      .catch(() => true)
      .then((confirmed) => {
        asking = false
        if (confirmed || !deps.shouldAsk()) {
          allowed = true
          deps.quit()
        } else {
          deps.cancelled?.()
        }
      })
  }
}
