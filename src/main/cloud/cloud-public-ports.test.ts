import { beforeEach, describe, expect, it, vi } from 'vitest'

type Route = { port: number; subdomain: string; url: string }

type VercelMock = {
  routes: Route[]
  updates: number[][]
  // Vercel keeps a route after the update when set; models a Disable that did not take.
  ignoreUpdates: boolean
  replyWithRoutes: boolean
  listeners: string
}

const vercel = vi.hoisted(() => {
  const state: VercelMock = {
    routes: [],
    updates: [],
    ignoreUpdates: false,
    replyWithRoutes: true,
    listeners: ''
  }
  return state
})
const runtimes = vi.hoisted(() => {
  const state: { list: Record<string, unknown>[] } = { list: [] }
  return state
})

function route(port: number): Route {
  return { port, subdomain: `sb-rand${port}`, url: `https://sb-rand${port}.vercel.run` }
}

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: vi.fn(async () => {
      let routes = [...vercel.routes]
      return {
        get routes() {
          return routes
        },
        update: vi.fn(async ({ ports }: { ports: number[] }) => {
          vercel.updates.push(ports)
          if (!vercel.ignoreUpdates) {
            vercel.routes = ports.map(route)
          }
          if (vercel.replyWithRoutes) {
            routes = [...vercel.routes]
          }
        })
      }
    })
  }
}))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: vi.fn(async () => ({ token: 't', teamId: 'team', projectId: 'p' }))
}))
vi.mock('./cloud-sandbox-run', () => ({
  runSandboxScript: vi.fn(async () => vercel.listeners)
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => runtimes.list
}))
// The real modules pull in Electron-side helpers; only their port numbers matter here.
vi.mock('./cloud-ssh-access', () => ({ SANDBOX_SSH_BRIDGE_PORT: 8022 }))
vi.mock('./cloud-desktop', () => ({ SANDBOX_DESKTOP_PORT: 6080 }))

import {
  checkShareablePort,
  parseListeningPorts,
  portsAfter,
  sharedPortsOf
} from './cloud-public-ports-plan'
import { readPublicPorts, sharePortPublicly, stopSharingPort } from './cloud-public-ports'

const ENV = 'env-1'

beforeEach(() => {
  vercel.routes = [route(8022)]
  vercel.updates = []
  vercel.ignoreUpdates = false
  vercel.replyWithRoutes = true
  vercel.listeners = ''
  runtimes.list = [
    {
      recipeId: 'orca-cloud-vercel',
      runtimeEnvironmentId: ENV,
      status: 'running',
      recipeResult: { userData: { sandboxName: 'orca-abc' } }
    }
  ]
})

describe('public port plan', () => {
  it('refuses the SSH bridge, the desktop and every other internal port', () => {
    for (const port of [22, 5901, 6080, 6768, 8022]) {
      expect(() => checkShareablePort(port)).toThrow(/cannot be shared/)
    }
    for (const port of [0, 70_000, 3.5, '3000', null]) {
      expect(() => checkShareablePort(port)).toThrow(/between 1 and 65535/)
    }
    expect(checkShareablePort(3000)).toBe(3000)
  })

  it('always keeps the SSH bridge in the full port list', () => {
    expect(portsAfter([], 3000, 'share')).toEqual([3000, 8022])
    expect(portsAfter([route(8022), route(3000)], 3000, 'unshare')).toEqual([8022])
    expect(portsAfter([route(3000)], 8022, 'unshare')).toEqual([3000, 8022])
    expect(() => portsAfter([route(8022)], 6080, 'share')).toThrow(/cannot be shared/)
  })

  it('stops at Vercel’s 15 ports', () => {
    const full = Array.from({ length: 14 }, (_, index) => route(3000 + index))
    expect(() => portsAfter([route(8022), ...full], 4000, 'share')).toThrow(/at most 14/)
  })

  it('lists shared ports without the bridge, with Vercel’s random address', () => {
    expect(sharedPortsOf([route(8022), route(5173), route(3000)])).toEqual([
      { port: 3000, url: 'https://sb-rand3000.vercel.run' },
      { port: 5173, url: 'https://sb-rand5173.vercel.run' }
    ])
  })

  it('reads listeners from ss without Orca’s own and marks loopback-only ones', () => {
    const output = [
      'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:*',
      'LISTEN 0 511 [::]:3000 [::]:*',
      'LISTEN 0 128 127.0.0.1:5173 0.0.0.0:*',
      'LISTEN 0 128 [::1]:5173 [::]:*',
      'LISTEN 0 128 0.0.0.0:8022 0.0.0.0:*',
      'LISTEN 0 128 127.0.0.1:6080 0.0.0.0:*',
      'LISTEN 0 128 *:22 *:*',
      'garbage'
    ].join('\n')
    expect(parseListeningPorts(output)).toEqual([
      { port: 3000, loopbackOnly: false },
      { port: 5173, loopbackOnly: true }
    ])
  })
})

describe('sharing a sandbox port', () => {
  it('nothing is public until the person shares a port', async () => {
    vercel.listeners = 'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:*'
    await expect(readPublicPorts('/u', ENV)).resolves.toEqual({
      shared: [],
      listening: [{ port: 3000, loopbackOnly: false }]
    })
    expect(vercel.updates).toEqual([])
  })

  it('share adds a route and returns its address; disable removes it again', async () => {
    await expect(sharePortPublicly('/u', ENV, 3000)).resolves.toEqual({
      port: 3000,
      url: 'https://sb-rand3000.vercel.run'
    })
    expect(vercel.updates).toEqual([[3000, 8022]])
    expect((await readPublicPorts('/u', ENV)).shared).toHaveLength(1)

    await stopSharingPort('/u', ENV, 3000)
    expect(vercel.updates.at(-1)).toEqual([8022])
    expect(vercel.routes.map((entry) => entry.port)).toEqual([8022])
  })

  it('reads the address back when Vercel’s reply has no routes', async () => {
    vercel.replyWithRoutes = false
    await expect(sharePortPublicly('/u', ENV, 3000)).resolves.toMatchObject({ port: 3000 })
  })

  it('disable fails loudly when Vercel still serves the port', async () => {
    vercel.routes = [route(8022), route(3000)]
    vercel.ignoreUpdates = true
    await expect(stopSharingPort('/u', ENV, 3000)).rejects.toThrow(/still public/)
  })

  it('refuses internal ports before calling Vercel', async () => {
    await expect(sharePortPublicly('/u', ENV, 8022)).rejects.toThrow(/cannot be shared/)
    await expect(sharePortPublicly('/u', ENV, 6080)).rejects.toThrow(/cannot be shared/)
    await expect(stopSharingPort('/u', ENV, 8022)).rejects.toThrow(/cannot be shared/)
    expect(vercel.updates).toEqual([])
  })

  it('runs two shares one after the other so neither drops the other', async () => {
    await Promise.all([sharePortPublicly('/u', ENV, 3000), sharePortPublicly('/u', ENV, 5173)])
    expect(vercel.routes.map((entry) => entry.port).sort()).toEqual([3000, 5173, 8022])
  })

  it('needs a running sandbox', async () => {
    runtimes.list = []
    await expect(sharePortPublicly('/u', ENV, 3000)).rejects.toThrow(/no running cloud sandbox/)
  })
})
