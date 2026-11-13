import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n/main-i18n', () => ({
  translateMain: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? name))
}))

import {
  confirmQuitWithBusyTerminals,
  countBusyTerminals,
  createQuitTerminalGuard,
  stopsTerminalsOnQuit
} from './quit-terminal-policy'

const desktop = { isServeMode: false, quittingForUpdate: false }

describe('terminals at quit', () => {
  it('stop by default in the workspace layout, and stay when the setting is on', () => {
    expect(stopsTerminalsOnQuit({ revioLayout: true }, desktop)).toBe(true)
    expect(
      stopsTerminalsOnQuit({ revioLayout: true, revioKeepTerminalsAfterQuit: false }, desktop)
    ).toBe(true)
    expect(
      stopsTerminalsOnQuit({ revioLayout: true, revioKeepTerminalsAfterQuit: true }, desktop)
    ).toBe(false)
  })

  it('stay in the classic layout, on a serve host and across an update restart', () => {
    expect(stopsTerminalsOnQuit({ revioLayout: false }, desktop)).toBe(false)
    expect(stopsTerminalsOnQuit(undefined, desktop)).toBe(false)
    expect(stopsTerminalsOnQuit({ revioLayout: true }, { ...desktop, isServeMode: true })).toBe(
      false
    )
    expect(
      stopsTerminalsOnQuit({ revioLayout: true }, { ...desktop, quittingForUpdate: true })
    ).toBe(false)
  })
})

describe('busy terminals', () => {
  it('counts the terminals with a program in the foreground', async () => {
    const source = {
      listProcesses: async () => [{ id: 'shell' }, { id: 'agent' }, { id: 'server' }],
      hasChildProcesses: async (id: string) => id !== 'shell'
    }
    expect(await countBusyTerminals(source, 1000)).toBe(2)
    expect(await countBusyTerminals(null, 1000)).toBe(0)
  })

  it('answers zero when the terminal service fails or does not answer in time', async () => {
    const failing = {
      listProcesses: async () => {
        throw new Error('daemon gone')
      },
      hasChildProcesses: async () => true
    }
    expect(await countBusyTerminals(failing, 1000)).toBe(0)
    const silent = {
      listProcesses: () => new Promise<{ id: string }[]>(() => undefined),
      hasChildProcesses: async () => true
    }
    expect(await countBusyTerminals(silent, 10)).toBe(0)
  })

  it('names how many would stop and quits only on Quit', async () => {
    const show = vi.fn(async () => ({ response: 0, checkboxChecked: false }))
    expect(await confirmQuitWithBusyTerminals(3, show)).toBe(true)
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ message: '3 terminals are running a program', cancelId: 1 })
    )
    show.mockResolvedValueOnce({ response: 1, checkboxChecked: false })
    expect(await confirmQuitWithBusyTerminals(1, show)).toBe(false)
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: '1 terminal is running a program' })
    )
  })

  it('hands the dialog the signal that closes it', async () => {
    const show = vi.fn(async () => ({ response: 1, checkboxChecked: false }))
    const question = new AbortController()
    await confirmQuitWithBusyTerminals(2, show, question.signal)
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ signal: question.signal }))
  })
})

describe('quit guard', () => {
  function guard(busy: number, confirmed: boolean, shouldAsk = true) {
    const quit = vi.fn()
    const confirm = vi.fn(async () => confirmed)
    const cancelled = vi.fn()
    const listener = createQuitTerminalGuard({
      shouldAsk: () => shouldAsk,
      countBusy: async () => busy,
      confirm,
      quit,
      cancelled
    })
    const fire = () => {
      const event = { preventDefault: vi.fn() }
      listener(event)
      return event
    }
    return { fire, quit, confirm, cancelled }
  }
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('quits without asking when no terminal is busy', async () => {
    const { fire, quit, confirm } = guard(0, false)
    expect(fire().preventDefault).toHaveBeenCalled()
    await settled()
    expect(confirm).not.toHaveBeenCalled()
    expect(quit).toHaveBeenCalledOnce()
    // The quit it then asks for passes straight through.
    expect(fire().preventDefault).not.toHaveBeenCalled()
  })

  it('asks when terminals are busy and stays open on Cancel', async () => {
    const { fire, quit, confirm, cancelled } = guard(2, false)
    fire()
    await settled()
    expect(confirm).toHaveBeenCalledWith(2)
    expect(quit).not.toHaveBeenCalled()
    expect(cancelled).toHaveBeenCalledOnce()
    // A later Quit asks again.
    expect(fire().preventDefault).toHaveBeenCalled()
    await settled()
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('quits once the person confirms, and shows one dialog for repeated Quit presses', async () => {
    const { fire, quit, confirm } = guard(2, true)
    fire()
    fire()
    await settled()
    expect(confirm).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
  })

  describe('when a signal, logout or shutdown arrives during the question', () => {
    function overtaken(answer: boolean) {
      let processQuitRequested = false
      let closeDialog: (confirmed: boolean) => void = () => undefined
      const quit = vi.fn()
      const cancelled = vi.fn()
      const confirm = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            closeDialog = resolve
          })
      )
      const listener = createQuitTerminalGuard({
        shouldAsk: () => !processQuitRequested,
        countBusy: async () => 2,
        confirm,
        quit,
        cancelled
      })
      const fire = () => {
        const event = { preventDefault: vi.fn() }
        listener(event)
        return event
      }
      const signal = () => {
        processQuitRequested = true
        // The signal handler closes the dialog, which answers like Cancel, and quits.
        closeDialog(answer)
        return fire()
      }
      return { fire, signal, quit, confirm, cancelled }
    }

    it('lets the quit through while the dialog is still open', async () => {
      const { fire, signal } = overtaken(false)
      expect(fire().preventDefault).toHaveBeenCalled()
      await settled()
      expect(signal().preventDefault).not.toHaveBeenCalled()
    })

    it('takes the closed dialog as a confirmed Quit, not as Cancel', async () => {
      const { fire, signal, quit, cancelled } = overtaken(false)
      fire()
      await settled()
      signal()
      await settled()
      expect(quit).toHaveBeenCalledOnce()
      expect(cancelled).not.toHaveBeenCalled()
      // Every later pass goes straight through.
      expect(fire().preventDefault).not.toHaveBeenCalled()
    })

    it('does not open the dialog when the signal arrives while it still counts', async () => {
      let processQuitRequested = false
      let counted: (busy: number) => void = () => undefined
      const quit = vi.fn()
      const confirm = vi.fn(async () => false)
      const listener = createQuitTerminalGuard({
        shouldAsk: () => !processQuitRequested,
        countBusy: () =>
          new Promise<number>((resolve) => {
            counted = resolve
          }),
        confirm,
        quit
      })
      listener({ preventDefault: vi.fn() })
      processQuitRequested = true
      counted(3)
      await settled()
      expect(confirm).not.toHaveBeenCalled()
      expect(quit).toHaveBeenCalledOnce()
    })
  })

  it('stays out of a quit that keeps terminals or came from a signal', () => {
    const { fire, quit } = guard(2, false, false)
    expect(fire().preventDefault).not.toHaveBeenCalled()
    expect(quit).not.toHaveBeenCalled()
  })
})
