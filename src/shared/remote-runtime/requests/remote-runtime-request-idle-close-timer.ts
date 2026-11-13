const IDLE_CLOSE_MS = 60_000

export class RemoteRuntimeRequestIdleCloseTimer {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly onIdle: () => void) {}

  schedule(): void {
    this.clear()
    this.timer = setTimeout(() => this.onIdle(), IDLE_CLOSE_MS)
    if (typeof this.timer.unref === 'function') {
      this.timer.unref()
    }
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
