/** What a player key does; seconds are relative, rate is absolute. */
export type MediaPlayerKeyAction =
  | { kind: 'toggle-play' }
  | { kind: 'seek'; seconds: number }
  | { kind: 'rate'; step: 1 | -1 }
  | { kind: 'mute' }
  | { kind: 'fullscreen' }

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

/**
 * The video player keys: Space or k play/pause, j/l back/forward 10s, ←/→ 5s, , and . one
 * frame (paused), < and > slower/faster, m mute, f fullscreen.
 */
export function mediaPlayerKeyAction(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}): MediaPlayerKeyAction | null {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null
  }
  switch (event.key) {
    case ' ':
    case 'k':
      return { kind: 'toggle-play' }
    case 'j':
      return { kind: 'seek', seconds: -10 }
    case 'l':
      return { kind: 'seek', seconds: 10 }
    case 'ArrowLeft':
      return { kind: 'seek', seconds: -5 }
    case 'ArrowRight':
      return { kind: 'seek', seconds: 5 }
    case ',':
      return { kind: 'seek', seconds: -1 / 30 }
    case '.':
      return { kind: 'seek', seconds: 1 / 30 }
    case '<':
      return { kind: 'rate', step: -1 }
    case '>':
      return { kind: 'rate', step: 1 }
    case 'm':
      return { kind: 'mute' }
    case 'f':
      return { kind: 'fullscreen' }
    default:
      return null
  }
}

/** The next playback rate one step slower or faster, within the 0.25×–2× range. */
export function steppedPlaybackRate(current: number, step: 1 | -1): number {
  const index = RATES.findIndex((rate) => rate >= current - 0.001)
  const from = index === -1 ? RATES.length - 1 : index
  return RATES.at(Math.min(RATES.length - 1, Math.max(0, from + step))) ?? current
}

/** Applies a key's action to a media element. */
export function applyMediaPlayerKey(media: HTMLMediaElement, action: MediaPlayerKeyAction): void {
  switch (action.kind) {
    case 'toggle-play':
      if (media.paused) {
        void media.play().catch(() => {})
      } else {
        media.pause()
      }
      return
    case 'seek': {
      const end = Number.isFinite(media.duration) ? media.duration : Number.POSITIVE_INFINITY
      media.currentTime = Math.min(end, Math.max(0, media.currentTime + action.seconds))
      return
    }
    case 'rate':
      media.playbackRate = steppedPlaybackRate(media.playbackRate, action.step)
      return
    case 'mute':
      media.muted = !media.muted
      return
    case 'fullscreen':
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      } else {
        void media.requestFullscreen?.().catch(() => {})
      }
  }
}
