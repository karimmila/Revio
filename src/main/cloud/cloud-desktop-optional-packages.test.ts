import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_DESKTOP_CHROME_PROFILE } from '../../shared/cloud/cloud-desktop-browser'
import { DESKTOP_OPTIONAL_PACKAGES_JOB } from './cloud-desktop-optional-packages'

const run = promisify(execFile)

let bin: string
let chrome: ChildProcess
let started: string

function stub(name: string, body: string): void {
  const path = join(bin, name)
  writeFileSync(path, `#!/bin/bash\n${body}\n`)
  chmodSync(path, 0o755)
}

/** The job against stand-ins: `chrome` is a sleeping process, and starting Chrome leaves a file. */
async function runJob(options: { startedHere: boolean; title: string }): Promise<string> {
  const { stdout } = await run(
    'bash',
    [
      '-c',
      // The sandbox's log path is this machine's shared temp folder; keep the run inside its own.
      DESKTOP_OPTIONAL_PACKAGES_JOB.replaceAll('/tmp/orca-chrome.log', join(bin, 'chrome.log')),
      'job',
      options.startedHere ? '1' : '0'
    ],
    {
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        FAKE_CHROME_PID: String(chrome.pid),
        FAKE_TITLE: options.title,
        FAKE_STARTED: started
      }
    }
  )
  return stdout
}

const chromeRuns = (): boolean => chrome.exitCode === null && chrome.signalCode === null

beforeEach(() => {
  bin = mkdtempSync(join(tmpdir(), 'desktop-optional-'))
  started = join(bin, 'chrome-started')
  chrome = spawn('sleep', ['30'], { stdio: 'ignore' })
  stub('sudo', 'exit 0')
  stub('fc-cache', 'exit 0')
  stub('setsid', 'exec "$@"')
  stub('nohup', 'exec "$@"')
  stub('google-chrome', 'echo "$@" > "$FAKE_STARTED"')
  stub(
    'ps',
    `kill -0 "$FAKE_CHROME_PID" 2>/dev/null && echo "$FAKE_CHROME_PID /opt/google/chrome/chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE}"; true`
  )
  stub('xdotool', 'if [ "$1" = search ]; then echo 41; echo 42; else echo "$FAKE_TITLE"; fi')
})
afterEach(() => {
  chrome.kill()
  rmSync(bin, { recursive: true, force: true })
})

describe('the desktop job that installs the emoji font and browser tools', () => {
  it('is valid bash', () => {
    execFileSync('bash', ['-n', '-c', DESKTOP_OPTIONAL_PACKAGES_JOB])
  })

  it('starts the Chrome it opened again while it still shows only a new tab', async () => {
    const output = await runJob({ startedHere: true, title: 'New Tab - Google Chrome' })
    expect(output).toContain('Chrome started again with the new fonts.')
    // Chrome starts detached, so its stand-in may still be on its way.
    await vi.waitFor(() => expect(existsSync(started)).toBe(true))
    expect(chromeRuns()).toBe(false)
  })

  it('leaves a Chrome that shows a page somebody opened', async () => {
    const output = await runJob({ startedHere: true, title: 'Pull requests - Google Chrome' })
    expect(output).toContain('Chrome is in use')
    expect(chromeRuns()).toBe(true)
    expect(existsSync(started)).toBe(false)
  })

  it('leaves a Chrome that was already running before this desktop start', async () => {
    await runJob({ startedHere: false, title: 'New Tab - Google Chrome' })
    expect(chromeRuns()).toBe(true)
    expect(existsSync(started)).toBe(false)
  })

  it('stops without touching Chrome when the install is refused', async () => {
    stub('sudo', 'exit 1')
    await expect(runJob({ startedHere: true, title: 'New Tab - Google Chrome' })).rejects.toThrow()
    expect(chromeRuns()).toBe(true)
    expect(existsSync(started)).toBe(false)
  })
})
