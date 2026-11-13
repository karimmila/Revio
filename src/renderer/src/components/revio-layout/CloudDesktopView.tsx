import React from 'react'
import type RFB from '@novnc/novnc'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cloudDesktopPassword } from '@/lib/cloud-desktop'
import {
  commandChordForDesktop,
  decideDesktopCopy,
  macTextForDesktop
} from './cloud-desktop-clipboard'

// The desktop requests the text after a clipboard notice; the Ctrl+V must not beat it there.
const PASTE_SETTLE_MS = 150

// noVNC awaits a WebCodecs probe at module top level (core/util/browser.js). Imported statically
// it held up the whole renderer bundle and the window stayed blank (2026-11-10), so it loads here.
let rfbModule: Promise<{ default: typeof RFB }> | null = null
function loadRfb(): Promise<{ default: typeof RFB }> {
  rfbModule ??= import('@novnc/novnc')
  return rfbModule
}

function attachDesktop(
  rfb: RFB,
  container: HTMLElement,
  options: {
    viewOnly: boolean
    autoFocus: boolean
    setState: (state: 'connecting' | 'connected' | 'disconnected') => void
    onDisconnected?: () => void
  }
): () => void {
  const { viewOnly, autoFocus, setState } = options
  rfb.scaleViewport = true
  rfb.resizeSession = false
  rfb.viewOnly = viewOnly
  rfb.focusOnClick = !viewOnly
  rfb.background = '#000'
  let lastSent: string | null = null
  const focused = (): boolean => document.hasFocus() && container.contains(document.activeElement)

  const onConnect = (): void => {
    setState('connected')
    if (autoFocus && !viewOnly) {
      rfb.focus()
    }
  }
  let disconnected = false
  const onDisconnect = (): void => {
    disconnected = true
    setState('disconnected')
    options.onDisconnected?.()
  }
  const onClipboard = (event: Event): void => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : null
    const text = detail && typeof detail === 'object' && 'text' in detail ? detail.text : undefined
    const verdict = decideDesktopCopy(text, { interactive: !viewOnly, focused: focused() })
    if (verdict === 'too-large') {
      toast.info(
        translate(
          'auto.components.revioLayout.desktopCopyTooLarge',
          'The desktop copy was larger than 1 MB, so it stayed in the desktop.'
        )
      )
      return
    }
    if (verdict !== 'accept' || typeof text !== 'string') {
      return
    }
    lastSent = text
    void window.api.ui.writeClipboardText(text).then(
      () =>
        toast.success(
          translate('auto.components.revioLayout.desktopCopied', 'Copied from cloud desktop'),
          { id: 'cloud-desktop-copied' }
        ),
      () => {}
    )
  }
  rfb.addEventListener('connect', onConnect)
  rfb.addEventListener('disconnect', onDisconnect)
  rfb.addEventListener('clipboard', onClipboard)

  const sendMacClipboard = async (force: boolean): Promise<boolean> => {
    const text = await window.api.ui.readClipboardText().catch(() => '')
    const next = macTextForDesktop(text, force ? null : lastSent)
    if (next === null) {
      return false
    }
    lastSent = next
    rfb.clipboardPasteFrom(next)
    return true
  }
  // Focus is the user choosing to work in the desktop, so the Mac clipboard follows them in.
  const onFocusIn = (): void => {
    if (!viewOnly) {
      void sendMacClipboard(false)
    }
  }
  const onKey = (event: KeyboardEvent): void => {
    if (viewOnly || (!event.metaKey && event.key !== 'Meta')) {
      return
    }
    // ⌘ never reaches the desktop as Super: Linux apps would see Super+C, not Ctrl+C.
    event.preventDefault()
    event.stopPropagation()
    const chord = event.type === 'keydown' ? commandChordForDesktop(event) : null
    if (!chord || event.repeat) {
      return
    }
    const press = (): void => {
      rfb.sendKey(chord.modifier, 'ControlLeft', true)
      rfb.sendKey(chord.key, null, true)
      rfb.sendKey(chord.key, null, false)
      rfb.sendKey(chord.modifier, 'ControlLeft', false)
    }
    if (!chord.paste) {
      press()
      return
    }
    void sendMacClipboard(true).then((sent) =>
      sent ? window.setTimeout(press, PASTE_SETTLE_MS) : press()
    )
  }
  container.addEventListener('focusin', onFocusIn)
  container.addEventListener('keydown', onKey, true)
  container.addEventListener('keyup', onKey, true)
  return () => {
    container.removeEventListener('focusin', onFocusIn)
    container.removeEventListener('keydown', onKey, true)
    container.removeEventListener('keyup', onKey, true)
    rfb.removeEventListener('connect', onConnect)
    rfb.removeEventListener('disconnect', onDisconnect)
    rfb.removeEventListener('clipboard', onClipboard)
    // noVNC logs an error when a closed connection is asked to disconnect again.
    if (!disconnected) {
      rfb.disconnect()
    }
  }
}

/**
 * The sandbox's screen, drawn by the noVNC client bundled with Orca. Only the VNC websocket goes
 * to the sandbox (through the workspace's SSH tunnel); no page or script from the sandbox runs in
 * this window. `viewOnly` is the small preview: no input and no clipboard.
 */
export function CloudDesktopView({
  wsUrl,
  viewOnly,
  autoFocus = false,
  className,
  onDisconnected
}: {
  wsUrl: string
  viewOnly: boolean
  autoFocus?: boolean
  className?: string
  /** The sandbox slept or its tunnel moved; the owner starts the desktop again. */
  onDisconnected?: () => void
}): React.JSX.Element {
  const onDisconnectedRef = React.useRef(onDisconnected)
  onDisconnectedRef.current = onDisconnected
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting'
  )
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    let cleanup: (() => void) | null = null
    let disposed = false
    void loadRfb().then(({ default: RfbClient }) => {
      if (!disposed) {
        const password = cloudDesktopPassword(wsUrl)
        const client = new RfbClient(container, wsUrl, {
          shared: true,
          ...(password ? { credentials: { password } } : {})
        })
        cleanup = attachDesktop(client, container, {
          viewOnly,
          autoFocus,
          setState,
          onDisconnected: () => onDisconnectedRef.current?.()
        })
      }
    })
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [wsUrl, viewOnly, autoFocus])

  return (
    <div className={className} data-cloud-desktop-view={viewOnly ? 'preview' : 'interactive'}>
      <div ref={containerRef} className="h-full w-full" />
      {state === 'disconnected' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {translate(
            'auto.components.revioLayout.desktopReconnecting',
            'The desktop disconnected. Reconnecting…'
          )}
        </div>
      ) : null}
    </div>
  )
}
