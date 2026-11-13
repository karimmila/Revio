// noVNC ships plain ES modules without types; this covers what the cloud desktop view uses.
declare module '@novnc/novnc' {
  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      urlOrChannel: string,
      options?: { shared?: boolean; credentials?: { password?: string } }
    )
    scaleViewport: boolean
    resizeSession: boolean
    viewOnly: boolean
    focusOnClick: boolean
    background: string
    sendKey(keysym: number, code: string | null, down?: boolean): void
    clipboardPasteFrom(text: string): void
    focus(options?: FocusOptions): void
    blur(): void
    disconnect(): void
  }
}
