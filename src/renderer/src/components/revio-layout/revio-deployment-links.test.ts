import { expect, it } from 'vitest'
import { viewableDeployments } from './revio-deployment-links'

const at = (minute: number): string => `2026-11-09T10:${String(minute).padStart(2, '0')}:00Z`

it("keeps each environment's newest successful deployment with a URL", () => {
  const list = viewableDeployments([
    { id: 1, environment: 'Preview', state: 'success', url: 'https://old', createdAt: at(1) },
    { id: 2, environment: 'Preview', state: 'success', url: 'https://new', createdAt: at(2) },
    { id: 3, environment: 'Production', state: 'failure', url: 'https://p', createdAt: at(3) },
    { id: 4, environment: 'Storybook', state: 'success', url: null, createdAt: at(4) }
  ])
  expect(list.map((deployment) => deployment.url)).toEqual(['https://new'])
})

it('hides an environment whose newest deployment is still running', () => {
  expect(
    viewableDeployments([
      { id: 1, environment: 'Preview', state: 'success', url: 'https://a', createdAt: at(1) },
      { id: 2, environment: 'Preview', state: 'in_progress', url: null, createdAt: at(2) }
    ])
  ).toEqual([])
})
