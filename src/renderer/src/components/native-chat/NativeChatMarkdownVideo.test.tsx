// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatMarkdownVideo, isNativeChatVideoSource } from './NativeChatMarkdownVideo'
import { NativeChatMarkdownImageOwnerContext } from './native-chat-markdown-image-owner'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const owner = {
  fileLinkContext: { worktreeId: 'w', worktreePath: '/w', runtimeEnvironmentId: null },
  runtimeContext: { target: { kind: 'local' as const }, worktreeId: 'w', worktreePath: '/w' },
  isVisible: true
}

it('knows a video source by its extension', () => {
  expect(isNativeChatVideoSource('demo/clip.mp4')).toBe(true)
  expect(isNativeChatVideoSource('https://x.dev/a.webm?t=1')).toBe(true)
  expect(isNativeChatVideoSource('shot.png')).toBe(false)
  expect(isNativeChatVideoSource(undefined)).toBe(false)
})

it('a web video plays at once', () => {
  render(<NativeChatMarkdownVideo src="https://x.dev/a.mp4" />)
  expect(document.querySelector('video')?.getAttribute('src')).toBe('https://x.dev/a.mp4')
})

it('a local video plays after a click, through the media preview', async () => {
  const readFile = vi.fn(async () => ({
    content: '',
    isBinary: true,
    mediaUrl: 'orca-media://file/t'
  }))
  vi.stubGlobal('api', { fs: { readFile } })
  render(
    <NativeChatMarkdownImageOwnerContext.Provider value={owner}>
      <NativeChatMarkdownVideo src="clip.mp4" />
    </NativeChatMarkdownImageOwnerContext.Provider>
  )
  expect(document.querySelector('video')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Play clip.mp4' }))
  await vi.waitFor(() =>
    expect(document.querySelector('video')?.getAttribute('src')).toBe('orca-media://file/t')
  )
  expect(readFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/w/clip.mp4', rangePreview: true })
  )
})

const remoteOwner = { ...owner, runtimeContext: { ...owner.runtimeContext, connectionId: 'ssh-1' } }

it('a video on a remote host says it is unavailable', () => {
  render(
    <NativeChatMarkdownImageOwnerContext.Provider value={remoteOwner}>
      <NativeChatMarkdownVideo src="clip.mp4" />
    </NativeChatMarkdownImageOwnerContext.Provider>
  )
  expect(screen.getByRole('status').textContent).toBe('Video unavailable: clip.mp4')
})
