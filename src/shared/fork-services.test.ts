import { describe, expect, it } from 'vitest'
import { FORK_IDENTITY, type ForkServices } from './fork-identity'
import {
  forkDocsUrl,
  forkServiceEndpoint,
  forkServiceUrl,
  forkTelemetryWriteKey,
  isForkServiceEnabled,
  type ForkServiceName
} from './fork-services'

const NAMES: ForkServiceName[] = Object.keys(FORK_IDENTITY.services).filter(
  (name): name is ForkServiceName => name !== 'telemetryWriteKey'
)

function services(overrides: Partial<ForkServices>): ForkServices {
  return { ...FORK_IDENTITY.services, ...overrides }
}

describe('fork services', () => {
  // issuesUrl is a page the browser opens (Help > Report an Issue); the app requests nothing from it.
  const BROWSER_LINKS: ForkServiceName[] = ['issuesUrl']

  it('ships every hosted service off', () => {
    expect(NAMES.length).toBeGreaterThan(10)
    for (const name of NAMES.filter((candidate) => !BROWSER_LINKS.includes(candidate))) {
      expect(forkServiceUrl(name)).toBeNull()
      expect(isForkServiceEnabled(name)).toBe(false)
    }
    expect(forkTelemetryWriteKey()).toBeNull()
    expect(forkDocsUrl('/docs/terminal')).toBeNull()
    expect(forkServiceEndpoint('whatsNewUrl', 'whats-new/changelog.json')).toBeNull()
  })

  it('points Report an Issue at the fork tracker on github.com', () => {
    expect(forkServiceUrl('issuesUrl')).toBe('https://github.com/karimmila/Revio/issues/new')
  })

  it('accepts only https endpoints', () => {
    expect(forkServiceUrl('feedbackUrl', services({ feedbackUrl: 'http://example.com' }))).toBe(
      null
    )
    expect(forkServiceUrl('feedbackUrl', services({ feedbackUrl: '  ' }))).toBeNull()
    expect(forkServiceUrl('feedbackUrl', services({ feedbackUrl: 'not a url' }))).toBeNull()
    expect(
      forkServiceUrl('feedbackUrl', services({ feedbackUrl: 'https://example.com/feedback' }))
    ).toBe('https://example.com/feedback')
  })

  it('joins paths onto a configured base', () => {
    const configured = services({ docsBaseUrl: 'https://example.com/help' })
    expect(forkDocsUrl('/docs/terminal#admin', configured)).toBe(
      'https://example.com/help/docs/terminal#admin'
    )
    expect(forkTelemetryWriteKey(services({ telemetryWriteKey: ' key ' }))).toBe('key')
  })
})
