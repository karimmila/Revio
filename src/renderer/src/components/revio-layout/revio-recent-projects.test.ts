import { expect, it } from 'vitest'
import { closedRecentProjects, rememberRecentProjects } from './revio-recent-projects'

const a = { path: '/a', name: 'a' }
const b = { path: '/b', name: 'b' }
const c = { path: '/c', name: 'c' }

it('keeps the newest open projects first, once each', () => {
  expect(rememberRecentProjects([a, b], [c, a])).toEqual([c, a, b])
})

it('lists only the remembered projects that are not open now', () => {
  expect(closedRecentProjects([a, b, c], new Set(['/b']))).toEqual([a, c])
})
