import { execFileSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  runs: new Array<{ script: string; env: Record<string, string> | undefined }>()
}))

vi.mock('@vercel/sandbox', () => ({ Sandbox: { get: vi.fn(async () => ({})) } }))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({ vercelScope: vi.fn(async () => ({})) }))
vi.mock('./cloud-sandbox-run', () => ({
  runSandboxScript: vi.fn(
    async (_sandbox: unknown, script: string, options?: { env?: Record<string, string> }) => {
      h.runs.push({ script, env: options?.env })
      return ''
    }
  )
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => [
    {
      recipeId: 'vercel-cloud',
      runtimeEnvironmentId: 'env-1',
      status: 'running',
      sshTargetId: 'ssh-1',
      recipeResult: { userData: { sandboxName: 'revio-abc' } }
    }
  ]
}))
vi.mock('../../shared/cloud/cloud-recipe', () => ({ VERCEL_CLOUD_RECIPE_ID: 'vercel-cloud' }))

const {
  DESKTOP_PASSWORD_ENV,
  DESKTOP_SCRIPT,
  SANDBOX_DESKTOP_PORT,
  desktopPasswordFor,
  startCloudDesktop
} = await import('./cloud-desktop')
const { SANDBOX_SSH_BRIDGE_PORT } = await import('./cloud-ssh-access')
const { BASE_PROVISION_SCRIPT } = await import('./cloud-base-image')
const { CLOUD_DESKTOP_CHROME_PROFILE, CLOUD_DESKTOP_OPTIONAL_PACKAGES } =
  await import('../../shared/cloud/cloud-desktop-browser')
const { DESKTOP_OPTIONAL_PACKAGES_JOB_PATH } = await import('./cloud-desktop-optional-packages')

describe('cloud desktop script', () => {
  it('never stops every websockify, since one is the SSH bridge', () => {
    // 2026-11-10: `pkill -x websockify` here cut the bridge and the sandbox stopped answering ssh.
    expect(DESKTOP_SCRIPT).not.toMatch(/pkill[^\n]*websockify/)
    expect(DESKTOP_SCRIPT).toContain(`/--web/ && /:${SANDBOX_DESKTOP_PORT} /`)
    expect(DESKTOP_SCRIPT).not.toContain(String(SANDBOX_SSH_BRIDGE_PORT))
  })

  it('serves only the VNC websocket, no web client from the sandbox', () => {
    expect(DESKTOP_SCRIPT).toMatch(
      new RegExp(`websockify 127\\.0\\.0\\.1:${SANDBOX_DESKTOP_PORT} localhost:5901`)
    )
    expect(DESKTOP_SCRIPT).not.toMatch(/websockify --web/)
  })

  it('asks for a VNC password and never starts a desktop without one', () => {
    expect(DESKTOP_SCRIPT).toContain('-SecurityTypes VncAuth -PasswordFile')
    // The only mention of "None" is the check that stops a desktop an older build started.
    expect(DESKTOP_SCRIPT.match(/SecurityTypes None/g)).toHaveLength(1)
    expect(DESKTOP_SCRIPT).toMatch(/grep -q -- '-SecurityTypes None'; then\n {2}pkill -x Xvnc/)
  })

  it('takes the password from the environment only, never from its own text', async () => {
    h.runs.length = 0
    const started = await startCloudDesktop('/user-data', 'env-1')
    expect(started.password).toMatch(/^[A-Za-z0-9_-]{8}$/)
    expect(h.runs).toHaveLength(1)
    expect(h.runs[0].env).toEqual({ [DESKTOP_PASSWORD_ENV]: started.password })
    expect(h.runs[0].script).not.toContain(started.password)
    // The script drops the variable before it starts Xvnc, Chrome or anything else.
    const unset = DESKTOP_SCRIPT.indexOf(`unset ${DESKTOP_PASSWORD_ENV}`)
    expect(unset).toBeGreaterThan(-1)
    expect(unset).toBeLessThan(DESKTOP_SCRIPT.indexOf('nohup'))
  })

  it('keeps one password per sandbox while the app runs, and a different one for each', () => {
    expect(desktopPasswordFor('revio-abc')).toBe(desktopPasswordFor('revio-abc'))
    expect(desktopPasswordFor('revio-abc')).not.toBe(desktopPasswordFor('revio-other'))
  })

  it('is valid bash and stops with a message when it has no password', () => {
    execFileSync('bash', ['-n', '-c', DESKTOP_SCRIPT])
    let stderr = ''
    try {
      execFileSync('bash', ['-c', DESKTOP_SCRIPT], {
        env: { PATH: process.env.PATH },
        stdio: 'pipe'
      })
    } catch (error) {
      stderr = String(error && typeof error === 'object' && 'stderr' in error ? error.stderr : '')
    }
    expect(stderr).toContain("TigerVNC's password tool")
  })

  it('keeps Xvnc clipboard sync on with the 1 MB cap', () => {
    expect(DESKTOP_SCRIPT).toContain('-SendCutText=1')
    expect(DESKTOP_SCRIPT).toContain('-AcceptCutText=1')
    expect(DESKTOP_SCRIPT).toContain('-MaxCutText=1048576')
  })

  it('installs the emoji font and browser tools in the background when a build lacks them', () => {
    const packages = CLOUD_DESKTOP_OPTIONAL_PACKAGES.join(' ')
    expect(packages).toContain('fonts-noto-color-emoji')
    expect(packages).toContain('xdotool')
    // Detached and never awaited: a slow or refused install cannot delay or fail the desktop.
    expect(DESKTOP_SCRIPT).toContain(
      `if ! dpkg -s ${packages} >/dev/null 2>&1; then\n  cat > ${DESKTOP_OPTIONAL_PACKAGES_JOB_PATH} <<'JOB'`
    )
    expect(DESKTOP_SCRIPT).toContain(
      `(setsid nohup bash ${DESKTOP_OPTIONAL_PACKAGES_JOB_PATH} "$chrome_started_here"`
    )
    expect(DESKTOP_SCRIPT).toContain(
      `sudo -n apt-get install -y -qq --no-install-recommends ${packages}`
    )
    // The base layer has them for new builds, and a mirror without one does not fail the build.
    expect(BASE_PROVISION_SCRIPT).toMatch(
      new RegExp(
        `${packages} \\\\\n[^\n]*\\|\\| echo "Optional desktop packages were not installed"`
      )
    )
    execFileSync('bash', ['-n', '-c', BASE_PROVISION_SCRIPT])
  })

  it('counts only the Chrome on the desktop’s own profile as the desktop browser', () => {
    // An agent's headless test browser is a chrome process too; with `pgrep -x chrome` the desktop
    // then came up with no browser.
    expect(DESKTOP_SCRIPT).toContain(
      `ps -C chrome -o args= 2>/dev/null | grep -q -- '--user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE}'`
    )
    expect(DESKTOP_SCRIPT).toContain(
      `desktop_chrome_runs || (setsid nohup google-chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE}`
    )
  })
})
