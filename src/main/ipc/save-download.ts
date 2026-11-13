import { app, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/** The largest file a preview may save; bigger ones are refused, not truncated. */
export const MAX_SAVED_DOWNLOAD_BYTES = 256 * 1024 * 1024

/** A name safe for the Downloads folder: no folders, no control or reserved characters. */
export function safeDownloadName(name: string): string {
  const cleaned = [...basename(name.replace(/\\/g, '/'))]
    .map((char) => (char.charCodeAt(0) < 0x20 || '<>:"|?*'.includes(char) ? '_' : char))
    .join('')
    .trim()
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'download'
}

/** `name`, or `name (2)`, `name (3)`… so a save never overwrites a file already there. */
export function uniqueDownloadPath(
  dir: string,
  name: string,
  exists: (path: string) => boolean = existsSync
): string {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = join(dir, name)
  for (let n = 2; exists(candidate); n += 1) {
    candidate = join(dir, `${stem} (${n})${ext}`)
  }
  return candidate
}

/** Saves bytes the renderer already holds (an image preview) into Downloads; returns the path. */
export function registerSaveDownloadHandler(): void {
  ipcMain.handle('shell:saveDownload', async (_event, name: unknown, bytes: unknown) => {
    if (typeof name !== 'string' || !(bytes instanceof Uint8Array)) {
      throw new Error('Invalid download')
    }
    if (bytes.byteLength > MAX_SAVED_DOWNLOAD_BYTES) {
      throw new Error('The file is too large to save.')
    }
    const path = uniqueDownloadPath(app.getPath('downloads'), safeDownloadName(name))
    await writeFile(path, bytes, { flag: 'wx' })
    return path
  })
}
