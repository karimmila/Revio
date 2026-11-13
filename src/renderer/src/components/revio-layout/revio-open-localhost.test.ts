import { expect, it, vi } from 'vitest'
import type { WorkspacePort } from '../../../../shared/workspace-ports'

vi.mock('@/lib/workspace-ports/workspace-port-actions', () => ({
  openWorkspacePortInBrowser: vi.fn(),
  scanWorkspacePortsForTarget: vi.fn(),
  shouldOpenWorkspacePortInOrcaBrowser: (settings: { openLinksInApp?: boolean } | null) =>
    settings?.openLinksInApp === true
}))

import { previewOpensInApp, workspaceLocalhostPort } from './revio-open-localhost'

function port(
  id: string,
  worktreeId: string,
  number: number,
  protocol: 'http' | 'unknown'
): WorkspacePort {
  return {
    id,
    kind: 'workspace',
    owner: { worktreeId, repoId: 'r', displayName: 'w', path: '/w', confidence: 'cwd' },
    bindHost: '::',
    connectHost: 'localhost',
    port: number,
    protocol
  }
}

it("picks the workspace's own HTTP port, lowest first", () => {
  const ports = [
    port('a', 'other', 3000, 'http'),
    port('b', 'mine', 9229, 'unknown'),
    port('c', 'mine', 5173, 'http'),
    port('d', 'mine', 3001, 'http')
  ]
  expect(workspaceLocalhostPort(ports, 'mine')?.port).toBe(3001)
  expect(workspaceLocalhostPort(ports, 'none')).toBeNull()
})

it('opens previews in Orca when links open in Orca or In-app browser preview is on', () => {
  expect(previewOpensInApp({ openLinksInApp: false })).toBe(false)
  expect(previewOpensInApp({ openLinksInApp: true })).toBe(true)
  expect(previewOpensInApp({ openLinksInApp: false, revioInAppBrowserPreview: true })).toBe(true)
  expect(previewOpensInApp(null)).toBe(false)
})
