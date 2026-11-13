import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CLOUD_ACTION_RUNS_DIR,
  cloudActionRunsFollow,
  loggedCloudActionScript
} from './cloud-action-runs'

let dir: string | null = null
afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
    dir = null
  }
})

function syntaxOk(script: string): void {
  execFileSync('bash', ['-n', '-c', script])
}

describe('loggedCloudActionScript', () => {
  it('is valid bash, and a quote in the name cannot leave its string', () => {
    const script = loggedCloudActionScript("it's $(rm -rf /)", 'echo hi')
    syntaxOk(script)
    expect(script).toContain(`'it'\\''s $(rm -rf /)'`)
    expect(script).toContain(`${CLOUD_ACTION_RUNS_DIR}`)
  })

  it('logs the output between the Run tab markers and keeps the exit code', () => {
    dir = mkdtempSync(join(tmpdir(), 'orca-runs-'))
    // macOS's BSD tools lack the sandbox's GNU `date +%N`, `head -n -N` and `xargs -r`.
    const script = loggedCloudActionScript('Dev', 'echo out; echo err >&2; exit 3')
      .replaceAll(CLOUD_ACTION_RUNS_DIR, join(dir, 'runs'))
      .replace('$(date +%s%N)', '1')
      .replace(/^ls -1 .*$/m, ':')
    const run = spawnSync('bash', ['-c', script], { encoding: 'utf8' })
    expect(run.status).toBe(3)
    expect(run.stdout).toContain('out')
    const [log] = readdirSync(join(dir, 'runs'))
    expect(log).toMatch(/^1-\d+\.log$/)
    const text = readFileSync(join(dir, 'runs', log ?? ''), 'utf8')
    expect(text).toContain('▶ Dev')
    expect(text).toContain('out\nerr\n')
    expect(text).toContain('■ Dev exited 3')
  })
})

describe('cloudActionRunsFollow', () => {
  const follow = cloudActionRunsFollow("No runs yet; it's $(quiet)")

  it('is one valid bash line that only reads the runs folder', () => {
    syntaxOk(follow)
    expect(follow).not.toContain('\n')
    expect(follow).toContain('tail -n +1 -F')
    expect(follow).not.toMatch(/curl|wget|nc |ssh /)
  })

  it('says it is waiting, with echo off, before any run exists', () => {
    dir = mkdtempSync(join(tmpdir(), 'orca-follow-'))
    const script = follow.replaceAll(CLOUD_ACTION_RUNS_DIR, join(dir, 'runs'))
    const run = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: 1500 })
    expect(run.stdout).toContain("No runs yet; it's $(quiet)")
    expect(follow.startsWith('stty -echo 2>/dev/null; ')).toBe(true)
  })
})
