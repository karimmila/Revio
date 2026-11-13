import { chmod, copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runProcess } from '@orca/process-host'

const launcherAsset = fileURLToPath(new URL('../../../resources/darwin/bin/orca', import.meta.url))
const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function makeBundle(executable: string, infoPlist: string | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-darwin-launcher-'))
  created.push(root)
  const contents = join(root, `${executable}.app`, 'Contents')
  await mkdir(join(contents, 'MacOS'), { recursive: true })
  await mkdir(join(contents, 'Resources', 'bin'), { recursive: true })
  const electron = join(contents, 'MacOS', executable)
  await writeFile(electron, '#!/bin/sh\necho "ran $(basename "$0") $*"\n')
  await chmod(electron, 0o755)
  if (infoPlist !== null) {
    await writeFile(join(contents, 'Info.plist'), infoPlist)
  }
  for (const name of ['orca', 'revio']) {
    const launcher = join(contents, 'Resources', 'bin', name)
    await copyFile(launcherAsset, launcher)
    await chmod(launcher, 0o755)
  }
  await symlink(join(contents, 'Resources', 'bin', 'revio'), join(root, 'revio'))
  return root
}

const plist = (executable: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>${executable}</string></dict></plist>
`

describe.runIf(process.platform === 'darwin')('macOS CLI launcher', () => {
  it('runs the executable Info.plist names, through the renamed command and the orca alias', async () => {
    const root = await makeBundle('Revio', plist('Revio'))

    for (const command of [
      join(root, 'revio'),
      join(root, 'Revio.app/Contents/Resources/bin/orca')
    ]) {
      const result = await runProcess({ program: command, args: ['status'], timeoutMs: 10_000 })
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/^ran Revio .*out\/cli\/index\.js status\n$/)
    }
  })

  it('falls back to the upstream executable name when Info.plist is unreadable', async () => {
    const root = await makeBundle('Orca', null)

    const result = await runProcess({ program: join(root, 'revio'), args: [], timeoutMs: 10_000 })
    expect(result.stdout).toMatch(/^ran Orca /)
  })
})
