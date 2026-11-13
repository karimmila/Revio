import { app, clipboard, ipcMain, nativeImage, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { MEDIA_PREVIEW_SCHEME } from '../../shared/media-file-extensions'
import {
  assertClipboardImageByteLengthWithinLimit,
  assertClipboardImageDimensionsWithinLimit
} from '../../shared/clipboard-image'
import { handleMediaPreviewRequest } from '../media/media-preview-protocol'
import { writeFileToClipboard, type ClipboardFileResult } from './clipboard-file-copy'
import { createClipboardStagedFiles } from './clipboard-staged-file'
import { ClipboardPublisherBusyError, publishClipboardOperation } from './clipboard-text-publisher'

const CHANNELS = [
  'clipboard:startStagedFile',
  'clipboard:appendStagedFile',
  'clipboard:cancelStagedFile',
  'clipboard:finishStagedFile',
  'clipboard:writeImageFromPreview'
] as const

function removeClipboardCopyOutHandlers(): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel)
  }
}

/**
 * Copy out of a cloud sandbox or paired server, always from a user's click: a file is staged on
 * this Mac before its reference goes on the clipboard, and an image shown in a viewer is copied
 * from its preview grant.
 */
export function registerClipboardCopyOutHandlers(
  assertTrustedClipboardSender: (event: IpcMainInvokeEvent) => void
): void {
  removeClipboardCopyOutHandlers()
  const stagedFiles = createClipboardStagedFiles(
    join(app.getPath('temp'), 'orca-clipboard-staging')
  )
  ipcMain.handle('clipboard:startStagedFile', (event, args: { name?: unknown }) => {
    assertTrustedClipboardSender(event)
    return stagedFiles.start(typeof args?.name === 'string' ? args.name : 'file')
  })
  ipcMain.handle(
    'clipboard:appendStagedFile',
    async (event, args: { transferId?: unknown; contentBase64?: unknown }) => {
      assertTrustedClipboardSender(event)
      if (typeof args?.transferId !== 'string' || typeof args.contentBase64 !== 'string') {
        throw new Error('Invalid clipboard copy chunk')
      }
      await stagedFiles.append(args.transferId, args.contentBase64)
    }
  )
  ipcMain.handle('clipboard:cancelStagedFile', async (event, args: { transferId?: unknown }) => {
    assertTrustedClipboardSender(event)
    if (typeof args?.transferId === 'string') {
      await stagedFiles.cancel(args.transferId)
    }
  })
  // Main publishes the staged path itself, so the renderer never names a Mac path to put on the clipboard.
  ipcMain.handle(
    'clipboard:finishStagedFile',
    async (event, args: { transferId?: unknown }): Promise<ClipboardFileResult> => {
      assertTrustedClipboardSender(event)
      if (typeof args?.transferId !== 'string') {
        return { ok: false, reason: 'invalid-path' }
      }
      const stagedPath = await stagedFiles.finish(args.transferId)
      return publishClipboardOperation(stagedPath.length * 2, () =>
        writeFileToClipboard(stagedPath, {
          platform: process.platform,
          desktop: process.env.XDG_CURRENT_DESKTOP,
          resolveFilePath: async (path) => ({ ok: true, path }),
          writeBuffer: (format, buffer) => clipboard.writeBuffer(format, buffer),
          runProcess
        })
      ).catch((error: unknown) => {
        if (error instanceof ClipboardPublisherBusyError) {
          return { ok: false, reason: 'clipboard-busy' }
        }
        throw error
      })
    }
  )
  // A sandbox or server image is shown through an orca-media grant URL, which taints a renderer
  // canvas; main reads the same grant and copies the decoded image, under the same image limits.
  ipcMain.handle(
    'clipboard:writeImageFromPreview',
    async (event, url: unknown): Promise<boolean> => {
      assertTrustedClipboardSender(event)
      if (typeof url !== 'string' || !url.startsWith(`${MEDIA_PREVIEW_SCHEME}://`)) {
        return false
      }
      // The grant's own handler serves the bytes; the scheme is not fetch-enabled for net.fetch.
      const response = await handleMediaPreviewRequest(new Request(url))
      if (!response.ok) {
        return false
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      try {
        assertClipboardImageByteLengthWithinLimit(buffer.byteLength)
      } catch {
        return false
      }
      const image = nativeImage.createFromBuffer(buffer)
      if (image.isEmpty()) {
        return false
      }
      try {
        assertClipboardImageDimensionsWithinLimit(image.getSize())
      } catch {
        return false
      }
      await publishClipboardOperation(buffer.byteLength, () => clipboard.writeImage(image))
      return true
    }
  )
}
