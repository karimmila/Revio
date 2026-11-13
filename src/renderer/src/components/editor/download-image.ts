import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

/** The file name a download of `title` gets: its last path part, else "image". */
export function downloadName(title: string): string {
  return title.split(/[/\\]/u).at(-1) || 'image'
}

function anchorDownload(src: string, title: string): void {
  const link = document.createElement('a')
  link.href = src
  link.download = downloadName(title)
  link.click()
}

/** Reads the whole body, reporting the share received when the size is known. */
export async function readWithProgress(
  response: Response,
  onProgress: (fraction: number) => void
): Promise<Uint8Array> {
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body?.getReader()
  if (!reader) {
    return new Uint8Array(await response.arrayBuffer())
  }
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    received += value.byteLength
    if (total > 0) {
      onProgress(Math.min(1, received / total))
    }
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * "Download file": saves into Downloads with progress and "Image saved". Without
 * Orca's save bridge (or when the source cannot be read) it falls back to a browser download.
 */
export async function downloadImage(src: string, title: string): Promise<void> {
  const save = window.api?.shell?.saveDownload
  if (!save) {
    anchorDownload(src, title)
    return
  }
  const id = toast.loading(translate('auto.components.editor.downloadingFile', 'Downloading file…'))
  try {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(String(response.status))
    }
    const bytes = await readWithProgress(response, (fraction) =>
      toast.loading(
        translate(
          'auto.components.editor.downloadingFilePercent',
          'Downloading file… {{value0}}%',
          {
            value0: Math.round(fraction * 100)
          }
        ),
        { id }
      )
    )
    await save(downloadName(title), bytes)
    toast.success(translate('auto.components.editor.imageSaved', 'Image saved'), { id })
  } catch {
    toast.dismiss(id)
    anchorDownload(src, title)
  }
}
