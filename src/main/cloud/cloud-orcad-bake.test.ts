import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/sandbox', () => ({}))

import { BAKE_TAR_EXCLUDES } from './cloud-orcad-bake'

describe('bake archive', () => {
  it('leaves macOS metadata files out of the slot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bake-'))
    mkdirSync(join(dir, 'node_modules'))
    for (const name of ['daemon-entry.js', '._daemon-entry.js', '.DS_Store', 'node_modules/._x']) {
      writeFileSync(join(dir, name), 'x')
    }
    const archive = join(dir, '..', `${dir.split('/').pop()}.tgz`)
    execFileSync('tar', ['-czf', archive, ...BAKE_TAR_EXCLUDES, '-C', dir, '.'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' }
    })
    const listed = execFileSync('tar', ['-tzf', archive]).toString().split('\n')
    expect(listed).toContain('./daemon-entry.js')
    expect(listed.some((entry) => /(^|\/)\._|\.DS_Store/.test(entry))).toBe(false)
  })
})
