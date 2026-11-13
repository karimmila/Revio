import { ORCAD_MANAGED_REMOTE_PORT } from '../../shared/orcad-managed-runtime'
import type { CloudListeningPort, CloudPublicPort } from '../../shared/cloud/cloud-types'
import { SANDBOX_DESKTOP_PORT } from './cloud-desktop'
import { SANDBOX_SSH_BRIDGE_PORT } from './cloud-ssh-access'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/**
 * Listeners Orca itself runs in a sandbox. None of them may get a public route: the bridge only
 * carries SSH, but VNC skips its password because it is reached through that tunnel alone, and
 * the Orca server trusts whoever reaches it.
 */
const INTERNAL_SANDBOX_PORTS: ReadonlySet<number> = new Set([
  22,
  5901,
  SANDBOX_DESKTOP_PORT,
  ORCAD_MANAGED_REMOTE_PORT,
  SANDBOX_SSH_BRIDGE_PORT
])

/** Vercel's limit per sandbox, the SSH bridge included. */
export const MAX_SANDBOX_PORTS = 15

type Route = { port: number; subdomain: string }

export function isInternalSandboxPort(port: number): boolean {
  return INTERNAL_SANDBOX_PORTS.has(port)
}

/** The port a person may share, or an error that says why not. */
export function checkShareablePort(port: unknown): number {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Pick a port between 1 and 65535.')
  }
  if (isInternalSandboxPort(port)) {
    throw new Error(
      `Port ${port} belongs to ${FORK_PRODUCT_NAME}'s connection to the sandbox and cannot be shared.`
    )
  }
  return port
}

export function publicUrlOf(route: Route): string {
  return `https://${route.subdomain}.vercel.run`
}

/** The person's shared ports, read from Vercel's live routes, so a link Orca forgot still shows. */
export function sharedPortsOf(routes: readonly Route[]): CloudPublicPort[] {
  return routes
    .filter((route) => !isInternalSandboxPort(route.port))
    .map((route) => ({ port: route.port, url: publicUrlOf(route) }))
    .sort((a, b) => a.port - b.port)
}

/**
 * The full port list for `Sandbox.update`, which drops every port it is not given. The SSH bridge
 * is always kept, or the workspace would lose its connection.
 */
export function portsAfter(
  routes: readonly Route[],
  port: number,
  change: 'share' | 'unshare'
): number[] {
  const ports = new Set(routes.map((route) => route.port))
  ports.add(SANDBOX_SSH_BRIDGE_PORT)
  if (change === 'share') {
    ports.add(checkShareablePort(port))
    if (ports.size > MAX_SANDBOX_PORTS) {
      throw new Error(`A sandbox can share at most ${MAX_SANDBOX_PORTS - 1} ports.`)
    }
  } else if (port !== SANDBOX_SSH_BRIDGE_PORT) {
    ports.delete(port)
  }
  return [...ports].sort((a, b) => a - b)
}

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|\[::1\]|::1|localhost)$/

/** TCP listeners from `ss -ltnH`, without Orca's own; `loopbackOnly` when none binds outward. */
export function parseListeningPorts(ssOutput: string): CloudListeningPort[] {
  const byPort = new Map<number, boolean>()
  for (const line of ssOutput.split('\n')) {
    const local = line.trim().split(/\s+/)[3]
    const match = local?.match(/^(.*):(\d+)$/)
    if (!match) {
      continue
    }
    const port = Number(match[2])
    if (!Number.isInteger(port) || isInternalSandboxPort(port)) {
      continue
    }
    const loopback = LOOPBACK.test(match[1].replace(/%.*$/, ''))
    byPort.set(port, (byPort.get(port) ?? true) && loopback)
  }
  return [...byPort]
    .map(([port, loopbackOnly]) => ({ port, loopbackOnly }))
    .sort((a, b) => a.port - b.port)
}
