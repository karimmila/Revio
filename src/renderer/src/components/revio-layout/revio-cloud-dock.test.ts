// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ repos: [] }) } }))

const { cloudDockCommand, dockTabStartup, prepareCloudDock } = await import('./revio-cloud-dock')

const SSH = "ssh -i /k/r1 -o 'IdentitiesOnly=yes' -- ubuntu@sb-1.sandbox"
const cloudRepo = { connectionId: null, executionHostId: 'runtime:env-1' as const }

describe('cloudDockCommand', () => {
  it('runs the command in the sandbox checkout over a terminal, then keeps a shell', () => {
    expect(cloudDockCommand(SSH, '/vercel/example-repo', 'bash /vercel/.orca-cloud-setup.sh')).toBe(
      ` printf '\\033[2m%s\\033[0m\\n' 'Connecting to the sandbox…'; ssh -t -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -i /k/r1 -o 'IdentitiesOnly=yes' -- ubuntu@sb-1.sandbox 'cd '\\''/vercel/example-repo'\\'' 2>/dev/null; bash /vercel/.orca-cloud-setup.sh; exec bash -l'; printf '\\n%s\\n' '[The sandbox connection closed. Run again to reconnect.]'; exec sleep 2147483647`
    )
  })

  it('refuses a line that is not the ssh route Orca builds', () => {
    expect(cloudDockCommand('rm -rf /', '/vercel/x', 'true')).toBeNull()
  })
})

describe('dockTabStartup', () => {
  it('starts a Mac workspace in its folder with its variables', () => {
    expect(dockTabStartup({ path: '/w' }, undefined, false, 'npm run dev', { A: '1' })).toEqual({
      startupCwd: '/w',
      pendingStartup: { command: 'npm run dev', env: { A: '1' } }
    })
  })

  it('reaches a cloud workspace over ssh once its route is read, with no Mac folder', async () => {
    expect(dockTabStartup({ path: '/vercel/r' }, cloudRepo, true, 'true', undefined)).toBeNull()
    Object.assign(window, { api: { cloud: { sshCommand: vi.fn(async () => SSH) } } })
    expect(await prepareCloudDock('env-1')).toBe(true)
    const startup = dockTabStartup({ path: '/vercel/r' }, cloudRepo, true, 'true', {})
    expect(startup?.startupCwd).toBeUndefined()
    expect(startup?.pendingStartup.command).toContain('ssh -t ')
    expect(startup?.pendingStartup.env).toBeUndefined()
  })

  it('keeps commands with variables, and remote hosts without a route, out of the dock', async () => {
    Object.assign(window, { api: { cloud: { sshCommand: vi.fn(async () => SSH) } } })
    await prepareCloudDock('env-1')
    expect(dockTabStartup({ path: '/vercel/r' }, cloudRepo, true, 'true', { A: '1' })).toBeNull()
    const sshHost = { connectionId: 'ssh-1', executionHostId: undefined }
    expect(dockTabStartup({ path: '/srv/r' }, sshHost, true, 'true', undefined)).toBeNull()
  })

  it('forgets the route of a sandbox that stopped running', async () => {
    Object.assign(window, {
      api: {
        cloud: {
          sshCommand: vi.fn(async () => {
            throw new Error('This workspace has no running cloud sandbox. Open it first.')
          })
        }
      }
    })
    expect(await prepareCloudDock('env-1')).toBe(false)
    expect(dockTabStartup({ path: '/vercel/r' }, cloudRepo, true, 'true', undefined)).toBeNull()
  })
})
