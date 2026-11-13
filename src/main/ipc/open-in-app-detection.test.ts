import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, nativeImage: {} }))

import {
  detectInstalledOpenInPresets,
  readInstalledOpenInPresetIcons
} from './open-in-app-detection'

describe('detectInstalledOpenInPresets', () => {
  it('finds bundles in /Applications, ~/Applications and the system Utilities folder', async () => {
    const present = new Set([
      '/Applications/Visual Studio Code.app',
      '/Users/me/Applications/Ghostty.app',
      '/System/Applications/Utilities/Terminal.app'
    ])
    const ids = await detectInstalledOpenInPresets('darwin', '/Users/me', async (path) =>
      present.has(path)
    )
    expect(ids.sort()).toEqual(['ghostty', 'terminal', 'vscode'])
  })

  it('detects nothing off macOS', async () => {
    expect(await detectInstalledOpenInPresets('linux', '/home/me', async () => true)).toEqual([])
  })
})

describe('readInstalledOpenInPresetIcons', () => {
  it("reads each installed app's icon from its bundle and skips one that cannot be read", async () => {
    const present = new Set(['/Applications/Zed.app', '/Applications/Cursor.app'])
    const icons = await readInstalledOpenInPresetIcons(
      'darwin',
      '/Users/me',
      async (path) => present.has(path),
      async (bundlePath) => {
        if (bundlePath.includes('Cursor')) {
          throw new Error('unreadable')
        }
        return `data:image/png;base64,${bundlePath}`
      }
    )
    expect(icons).toEqual({ zed: 'data:image/png;base64,/Applications/Zed.app' })
  })
})
