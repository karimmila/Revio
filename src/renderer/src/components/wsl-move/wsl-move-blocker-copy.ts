import { translate } from '@/i18n/i18n'
import type { WslMoveBlockerKind } from '../../../../shared/wsl-move/wsl-move-driver-types'

export function wslMoveBlockerTitle(kind: WslMoveBlockerKind, n: number): string {
  const one = n === 1
  switch (kind) {
    case 'agent-working':
      return one
        ? translate(
            'wslMove.blocker.agentWorkingOne',
            'An agent is working or waiting for an answer'
          )
        : translate(
            'wslMove.blocker.agentWorkingMany',
            '{{n}} agents are working or waiting for an answer',
            { n }
          )
    case 'process-running':
      return one
        ? translate('wslMove.blocker.processRunningOne', 'A terminal is running a program')
        : translate('wslMove.blocker.processRunningMany', '{{n}} terminals are running a program', {
            n
          })
    case 'agent-not-resumable':
      return one
        ? translate(
            'wslMove.blocker.agentNotResumableOne',
            'An agent cannot be resumed after the move'
          )
        : translate(
            'wslMove.blocker.agentNotResumableMany',
            '{{n}} agents cannot be resumed after the move',
            { n }
          )
    case 'unverifiable':
      return one
        ? translate(
            'wslMove.blocker.unverifiableOne',
            '{{productName}} cannot check a terminal right now'
          )
        : translate(
            'wslMove.blocker.unverifiableMany',
            '{{productName}} cannot check {{n}} terminals right now',
            {
              n
            }
          )
    case 'automation-running':
      return one
        ? translate('wslMove.blocker.automationRunningOne', 'An automation run is active')
        : translate('wslMove.blocker.automationRunningMany', '{{n}} automation runs are active', {
            n
          })
    case 'dispatch-running':
      return one
        ? translate('wslMove.blocker.dispatchRunningOne', 'An agent task is in progress')
        : translate('wslMove.blocker.dispatchRunningMany', '{{n}} agent tasks are in progress', {
            n
          })
    case 'scrollback-too-large':
      return one
        ? translate(
            'wslMove.blocker.scrollbackTooLargeOne',
            'A terminal has too much output history to move'
          )
        : translate(
            'wslMove.blocker.scrollbackTooLargeMany',
            '{{n}} terminals have too much output history to move',
            { n }
          )
  }
}

/** What the user can do about a blocker kind, given the actions main offers for it. */
export function wslMoveBlockerHint(kind: WslMoveBlockerKind): string {
  switch (kind) {
    case 'agent-working':
      return translate(
        'wslMove.blockerHint.agentWorking',
        'Let it finish, or stop it in its terminal, then check again.'
      )
    case 'process-running':
      return translate(
        'wslMove.blockerHint.processRunning',
        'Stop the program (for example a dev server or editor), then check again.'
      )
    case 'agent-not-resumable':
      return translate(
        'wslMove.blockerHint.agentNotResumable',
        'Exit the agent in its terminal, then check again.'
      )
    case 'unverifiable':
      return translate(
        'wslMove.blockerHint.unverifiable',
        'Wait a moment, then check again. Nothing is stopped to make the move happen.'
      )
    case 'automation-running':
    case 'dispatch-running':
      return translate('wslMove.blockerHint.wait', 'Wait for it to finish, then check again.')
    case 'scrollback-too-large':
      return translate(
        'wslMove.blockerHint.scrollbackTooLarge',
        'Clear the terminal output in those terminals, then check again.'
      )
  }
}
