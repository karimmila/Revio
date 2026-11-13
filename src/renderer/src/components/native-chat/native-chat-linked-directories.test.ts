import { expect, it } from 'vitest'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { linkableWorkspaces, withoutLinkedDirectory } from './native-chat-linked-directories'

it('removes a linked folder and drops an emptied workspace', () => {
  expect(withoutLinkedDirectory({ '/w': ['/a', '/b'] }, '/w', '/a')).toEqual({ '/w': ['/b'] })
  expect(withoutLinkedDirectory({ '/w': ['/a'], '/v': ['/c'] }, '/w', '/a')).toEqual({
    '/v': ['/c']
  })
  expect(withoutLinkedDirectory(undefined, '/w', '/a')).toEqual({})
})

it('offers the other workspaces on the same host, by name', () => {
  const ws = (id: string, path: string, displayName: string, hostId?: ExecutionHostId) => ({
    id,
    path,
    displayName,
    hostId
  })
  const byRepo = {
    r1: [ws('1', '/w', 'here'), ws('2', '/z', 'zeta')],
    r2: [ws('3', '/a', 'alpha'), ws('4', '/s', 'ssh one', 'ssh:box')]
  }
  expect(linkableWorkspaces(byRepo, { path: '/w' }).map((w) => w.displayName)).toEqual([
    'alpha',
    'zeta'
  ])
})
