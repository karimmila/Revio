import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLOUD_DESKTOP_BROWSER_INSTRUCTION,
  CLOUD_DESKTOP_CHROME_PROFILE,
  CLOUD_DESKTOP_PASSWORD_FILE,
  CLOUD_OPEN_URL_COMMAND_NAME,
  CLOUD_OPEN_URL_COMMAND_PATH,
  CLOUD_OPEN_URL_COMMAND_SCRIPT
} from './cloud-desktop-browser'

const DESKTOP_CHROME = `4242 /opt/google/chrome/chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} --start-maximized`
const DESKTOP_RENDERER = `4300 /opt/google/chrome/chrome --type=renderer --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE}`
const AGENT_CHROME = '5151 /opt/google/chrome/chrome --headless --user-data-dir=/tmp/playwright'

let root: string
let bin: string
let log: string
let command: string

/** A stand-in for one sandbox program: it logs its arguments, then prints `output`. */
function stub(name: string, output = '', exitCode = 0): void {
  writeFileSync(
    join(bin, name),
    `#!/bin/bash\necho "${name} $*" >> "${log}"\ncat <<'OUT'\n${output}\nOUT\nexit ${exitCode}\n`
  )
  chmodSync(join(bin, name), 0o755)
}

function run(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('bash', [command, ...args], {
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin` }
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

const calls = (): string[] =>
  existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cloud-open-url-'))
  bin = join(root, 'bin')
  log = join(root, 'calls.log')
  command = join(root, CLOUD_OPEN_URL_COMMAND_NAME)
  mkdirSync(bin)
  writeFileSync(command, CLOUD_OPEN_URL_COMMAND_SCRIPT)
  // The desktop is up, and its Chrome is running beside an agent's headless test browser.
  stub('ss', 'LISTEN 0 5 127.0.0.1:5901 0.0.0.0:*')
  stub('ps', [AGENT_CHROME, DESKTOP_RENDERER, DESKTOP_CHROME].join('\n'))
  stub('google-chrome')
  stub('xdotool', '77')
  stub('wmctrl')
  stub('sleep')
  // macOS has neither; in the sandbox they detach the browser from this command.
  for (const wrapper of ['setsid', 'nohup']) {
    writeFileSync(join(bin, wrapper), '#!/bin/bash\nexec "$@"\n')
    chmodSync(join(bin, wrapper), 0o755)
  }
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the sandbox command that shows a page on the desktop', () => {
  it('is valid bash and sits beside the pull-request command', () => {
    execFileSync('bash', ['-n', command])
    expect(CLOUD_OPEN_URL_COMMAND_PATH.endsWith(`/bin/${CLOUD_OPEN_URL_COMMAND_NAME}`)).toBe(true)
  })

  it('hands the URL to the Chrome already on the desktop and brings that window to the front', () => {
    const result = run('http://localhost:3000/notes?x=1&y=2')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('in front')
    const made = calls()
    // The same profile: Chrome opens a tab in its running window instead of a second browser.
    expect(made).toContain(
      `google-chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} --no-first-run --no-default-browser-check http://localhost:3000/notes?x=1&y=2`
    )
    // The window of the desktop's own browser process, not a renderer's or the agent's Chrome.
    expect(made).toContain('xdotool search --onlyvisible --pid 4242')
    expect(made).toContain('xdotool windowactivate 77')
    expect(made.some((call) => call.includes('--start-maximized'))).toBe(false)
  })

  it('starts the desktop’s Chrome on its profile when only another Chrome is running', () => {
    stub('ps', AGENT_CHROME)
    expect(run('https://example.com').status).toBe(0)
    expect(calls()).toContain(
      `google-chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} --no-first-run --no-default-browser-check --disable-dev-shm-usage --start-maximized https://example.com`
    )
  })

  it('falls back to wmctrl, and says so when nothing could raise the window', () => {
    stub('xdotool', '', 1)
    expect(run('https://example.com').stdout).toContain('in front')
    expect(calls()).toContain('wmctrl -x -a google-chrome')
    stub('wmctrl', '', 1)
    expect(run('https://example.com').stdout).toContain('could not be brought to the front')
  })

  describe('before the user has opened the desktop', () => {
    let passwordFile: string
    let screenUp: string

    /** No screen yet; `Xvnc` brings port 5901 up, as the real one does. */
    function desktopDown(): void {
      screenUp = join(root, 'screen-up')
      passwordFile = join(root, 'desktop', 'vncpasswd')
      // The sandbox's own folders do not exist on the machine that runs this test.
      writeFileSync(
        command,
        CLOUD_OPEN_URL_COMMAND_SCRIPT.replaceAll(CLOUD_DESKTOP_PASSWORD_FILE, passwordFile).replaceAll(
          '/tmp/orca-',
          `${root}/orca-`
        )
      )
      const program = (name: string, body: string): void => {
        writeFileSync(join(bin, name), `#!/bin/bash\necho "${name} $*" >> "${log}"\n${body}\n`)
        chmodSync(join(bin, name), 0o755)
      }
      program('ss', `[ -f "${screenUp}" ] && echo 'LISTEN 0 5 127.0.0.1:5901 0.0.0.0:*'; true`)
      program('Xvnc', `touch "${screenUp}"`)
      program('vncpasswd', 'cat >/dev/null; echo obfuscated')
      program('pgrep', 'exit 1')
      program('openbox', 'exit 0')
      stub('ps', AGENT_CHROME)
    }

    it('starts the screen with a password, opens the page and asks nothing of the user', () => {
      desktopDown()
      const result = run('https://example.com')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Opened https://example.com in the desktop browser.')
      expect(result.stdout).toContain("The user sees it when they open this workspace's Desktop tab")
      expect(result.stdout + result.stderr).not.toMatch(/ask the user|run this again/i)
      const made = calls()
      expect(
        made.some(
          (call) =>
            call.startsWith('Xvnc :1 -localhost -SecurityTypes VncAuth') &&
            call.includes(`-PasswordFile ${passwordFile}`)
        )
      ).toBe(true)
      expect(made.some((call) => call.includes('SecurityTypes None'))).toBe(false)
      expect(readFileSync(passwordFile, 'utf8').trim()).toBe('obfuscated')
      expect(made.map((call) => call.trim())).toContain('openbox')
      expect(made).toContain(
        `google-chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} --no-first-run --no-default-browser-check --disable-dev-shm-usage --start-maximized https://example.com`
      )
    })

    it('keeps the password the app already set', () => {
      desktopDown()
      mkdirSync(join(root, 'desktop'))
      writeFileSync(passwordFile, 'set-by-the-app')
      expect(run('https://example.com').status).toBe(0)
      expect(readFileSync(passwordFile, 'utf8')).toBe('set-by-the-app')
      expect(calls().some((call) => call.startsWith('vncpasswd'))).toBe(false)
    })

    it('opens nothing and says why when the screen does not come up', () => {
      desktopDown()
      writeFileSync(join(bin, 'Xvnc'), '#!/bin/bash\nexit 1\n')
      const result = run('https://example.com')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('the desktop did not start')
      expect(calls().some((call) => call.startsWith('google-chrome'))).toBe(false)
    })
  })

  it('wants exactly one URL', () => {
    expect(run().status).toBe(2)
    expect(run('a', 'b').status).toBe(2)
  })

  it('is the way the agent is told to show a page', () => {
    expect(CLOUD_DESKTOP_BROWSER_INSTRUCTION).toContain(`\`${CLOUD_OPEN_URL_COMMAND_PATH} <url>\``)
    expect(CLOUD_DESKTOP_BROWSER_INSTRUCTION).toContain(
      'Do not start Chrome on the desktop any other way'
    )
    expect(CLOUD_DESKTOP_BROWSER_INSTRUCTION).toContain('DISPLAY=:1 xdotool key F5')
    expect(CLOUD_DESKTOP_BROWSER_INSTRUCTION).toContain('Never kill Chrome')
    expect(CLOUD_DESKTOP_BROWSER_INSTRUCTION).toContain(
      'Do not ask the user to open the desktop first'
    )
  })
})
