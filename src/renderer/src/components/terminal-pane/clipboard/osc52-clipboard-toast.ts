import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { OSC52_CLIPBOARD_SETTING_ID } from './osc52-clipboard-setting-anchor'
import { getIntlLocale, translate } from '@/i18n/i18n'

let hasShownOsc52ClipboardBlockedToast = false
let hasShownOsc52ClipboardFailedToast = false

export function showOsc52ClipboardBlockedToast(): void {
  if (hasShownOsc52ClipboardBlockedToast) {
    return
  }

  toast.info(
    translate(
      'auto.components.terminal.pane.osc52.clipboard.blocked.toast.89eaa3e80b',
      'Terminal clipboard write blocked'
    ),
    {
      description: translate(
        'auto.components.terminal.pane.osc52.clipboard.blocked.toast.7cf51f74fd',
        'Enable TUI clipboard writes in Terminal settings to copy from SSH, Zellij, tmux, Neovim, fzf, or Grok.'
      ),
      duration: 12_000,
      action: {
        label: translate(
          'auto.components.terminal.pane.osc52.clipboard.blocked.toast.97c98f1afe',
          'Open Setting'
        ),
        onClick: () => {
          const store = useAppStore.getState()
          // Open the exact setting named by the remote-copy failure.
          store.setSettingsSearchQuery('')
          store.openSettingsTarget({
            pane: 'terminal',
            repoId: null,
            sectionId: OSC52_CLIPBOARD_SETTING_ID
          })
          store.openSettingsPage()
        }
      }
    }
  )
  // Latch after successful display so a throw cannot spend the session’s only notice.
  hasShownOsc52ClipboardBlockedToast = true
}

export function showOsc52ClipboardFailedToast(): void {
  if (hasShownOsc52ClipboardFailedToast) {
    return
  }

  toast.error(
    translate(
      'auto.components.terminal.pane.osc52.clipboard.failed.toast.62a0af2cb4',
      'Terminal clipboard copy could not be confirmed'
    ),
    {
      description: translate(
        'auto.components.terminal.pane.osc52.clipboard.failed.toast.fdd3e7e977',
        'The terminal app requested a copy, but {{productName}} could not confirm that it reached the system clipboard.'
      ),
      duration: 12_000
    }
  )
  // Latch only after successful display, as for blocked writes.
  hasShownOsc52ClipboardFailedToast = true
}

const OSC52_CLIPBOARD_COPY_RETRY_TOAST_ID = 'osc52-clipboard-copy-retry'

/** Browsers refuse clipboard writes without a recent gesture; the Copy click supplies one. Not latched: each refusal replaces the last. */
export function showOsc52ClipboardCopyRetryToast(
  text: string,
  writeClipboardText: (text: string) => Promise<void>
): void {
  toast.error(
    translate(
      'auto.components.terminal.pane.osc52.clipboard.failed.toast.de286dcfe1',
      'Terminal copy needs a click'
    ),
    {
      id: OSC52_CLIPBOARD_COPY_RETRY_TOAST_ID,
      description: translate(
        'auto.components.terminal.pane.osc52.clipboard.failed.toast.84c938ffa2',
        'The browser blocked a copy from the terminal app. Click Copy to put the text on your clipboard.'
      ),
      duration: 30_000,
      action: {
        label: translate(
          'auto.components.terminal.pane.osc52.clipboard.failed.toast.a73165c6c5',
          'Copy'
        ),
        onClick: () => {
          void writeClipboardText(text).catch(showOsc52ClipboardFailedToast)
        }
      }
    }
  )
}

const OSC52_REMOTE_COPIED_TOAST_ID = 'osc52-remote-copied'

/** Every copy from a sandbox or SSH host is announced, so a silent clipboard swap cannot happen. */
export function showOsc52RemoteCopiedToast(text: string, cloud: boolean): void {
  toast.success(
    cloud
      ? translate('auto.components.terminal.pane.osc52.remote.copiedSandbox', 'Copied from sandbox')
      : translate(
          'auto.components.terminal.pane.osc52.remote.copiedHost',
          'Copied from remote host'
        ),
    {
      id: OSC52_REMOTE_COPIED_TOAST_ID,
      description: translate(
        'auto.components.terminal.pane.osc52.remote.copiedLength',
        '{{value0}} characters are on your clipboard.',
        { value0: text.length.toLocaleString(getIntlLocale()) }
      )
    }
  )
}

const shownOsc52RemoteRefusals = new Set<string>()

export function showOsc52RemoteRefusedToast(
  verdict: 'refuse-source' | 'refuse-size' | 'refuse-idle',
  cloud: boolean
): void {
  if (shownOsc52RemoteRefusals.has(verdict)) {
    return
  }
  toast.info(
    cloud
      ? translate(
          'auto.components.terminal.pane.osc52.remote.blockedSandbox',
          'Clipboard write from sandbox blocked'
        )
      : translate(
          'auto.components.terminal.pane.osc52.remote.blockedHost',
          'Clipboard write from remote host blocked'
        ),
    {
      description:
        verdict === 'refuse-idle'
          ? translate(
              'auto.components.terminal.pane.osc52.remote.blockedIdle',
              'A terminal app can copy to this Mac only right after you type in it. Select the text and press ⌘C instead.'
            )
          : verdict === 'refuse-size'
            ? translate(
                'auto.components.terminal.pane.osc52.remote.blockedSize',
                'The copy was larger than 100 KB. Select the text and press ⌘C instead.'
              )
            : translate(
                'auto.components.terminal.pane.osc52.remote.blockedSource',
                'Only a terminal you type into can copy to this Mac. Agents and Setup or Run logs cannot. Select the text and press ⌘C instead.'
              ),
      duration: 8_000
    }
  )
  shownOsc52RemoteRefusals.add(verdict)
}
