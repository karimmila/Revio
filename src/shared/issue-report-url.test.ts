import { describe, expect, it } from 'vitest'
import { issueReportUrl } from './issue-report-url'

describe('issueReportUrl', () => {
  it('prefills the body with the app and OS versions and nothing else about the machine', () => {
    const url = new URL(
      issueReportUrl('https://github.com/example/app/issues/new', {
        appVersion: '1.4.214',
        platform: 'darwin',
        osVersion: '14.5',
        arch: 'arm64'
      })
    )
    expect(url.origin + url.pathname).toBe('https://github.com/example/app/issues/new')
    expect([...url.searchParams.keys()]).toEqual(['body'])
    expect(url.searchParams.get('body')).toBe(
      '**What happened**\n\n\n**Steps to reproduce**\n\n\n---\nRevio 1.4.214 · macOS 14.5 · arm64'
    )
  })

  it('never passes through a value that is not a plain version', () => {
    const body = new URL(
      issueReportUrl('https://github.com/example/app/issues/new', {
        appVersion: '/Users/someone/build 1.0',
        platform: 'darwin',
        osVersion: '',
        arch: 'arm64'
      })
    ).searchParams.get('body')
    expect(body).toContain('Revio unknown · macOS · arm64')
    expect(body).not.toContain('someone')
  })
})
