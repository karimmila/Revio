import { randomUUID } from 'node:crypto'
import { mkdir, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { sanitizeLocalDownloadFilename } from '../ipc/filesystem/local-download-filename'

/**
 * "Copy" on a file that lives in a cloud sandbox or on another Orca server: the user's click pulls
 * the bytes to a staging folder on this Mac, and only then does a file reference go on the
 * clipboard. The sandbox never starts this; the Mac reads from it, as for a download.
 */
export const CLIPBOARD_STAGED_FILE_MAX_BYTES = 50 * 1024 * 1024
const SESSION_TTL_MS = 5 * 60 * 1000

type Session = {
  path: string
  handle: Awaited<ReturnType<typeof open>>
  written: number
  timer: ReturnType<typeof setTimeout>
}

export function createClipboardStagedFiles(stagingRoot: string): {
  start: (name: string) => Promise<{ transferId: string }>
  append: (transferId: string, contentBase64: string) => Promise<void>
  finish: (transferId: string) => Promise<string>
  cancel: (transferId: string) => Promise<void>
} {
  const sessions = new Map<string, Session>()

  const close = async (transferId: string, discard: boolean): Promise<Session | null> => {
    const session = sessions.get(transferId)
    if (!session) {
      return null
    }
    sessions.delete(transferId)
    clearTimeout(session.timer)
    await session.handle.close().catch(() => {})
    if (discard) {
      await rm(session.path, { force: true }).catch(() => {})
    }
    return session
  }

  return {
    async start(name) {
      const safeName = sanitizeLocalDownloadFilename(name.trim() === '' ? 'file' : name)
      // A new copy replaces the clipboard, so earlier staged copies have nothing left to serve.
      if (sessions.size === 0) {
        await rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
      }
      const transferId = randomUUID()
      const dir = join(stagingRoot, transferId)
      await mkdir(dir, { recursive: true, mode: 0o700 })
      const path = join(dir, safeName)
      const handle = await open(path, 'wx', 0o600)
      const timer = setTimeout(() => void close(transferId, true), SESSION_TTL_MS)
      timer.unref?.()
      sessions.set(transferId, { path, handle, written: 0, timer })
      return { transferId }
    },
    async append(transferId, contentBase64) {
      const session = sessions.get(transferId)
      if (!session) {
        throw new Error('Clipboard copy not found')
      }
      const bytes = Buffer.from(contentBase64, 'base64')
      if (session.written + bytes.byteLength > CLIPBOARD_STAGED_FILE_MAX_BYTES) {
        await close(transferId, true)
        throw new Error('File is larger than the 50 MB copy limit')
      }
      await session.handle.writeFile(bytes)
      session.written += bytes.byteLength
    },
    async finish(transferId) {
      const session = await close(transferId, false)
      if (!session) {
        throw new Error('Clipboard copy not found')
      }
      return session.path
    },
    async cancel(transferId) {
      await close(transferId, true)
    }
  }
}
