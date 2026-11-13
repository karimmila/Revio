import { describe, expect, it } from 'vitest'
import { isNetworkFailure } from './network-failure'

describe('isNetworkFailure', () => {
  it('recognizes offline, DNS and timeout failures however fetch words them', () => {
    expect(isNetworkFailure(new TypeError('fetch failed'))).toBe(true)
    expect(
      isNetworkFailure(
        new TypeError('terminated', { cause: new Error('getaddrinfo ENOTFOUND api.vercel.com') })
      )
    ).toBe(true)
    expect(isNetworkFailure(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(
      true
    )
    expect(isNetworkFailure('net::ERR_INTERNET_DISCONNECTED')).toBe(true)
  })

  it('leaves an answer from the service alone', () => {
    expect(isNetworkFailure(new Error('GitHub answered 403 while reading your account.'))).toBe(
      false
    )
    expect(isNetworkFailure(new Error('This token reaches no team.'))).toBe(false)
    expect(isNetworkFailure(undefined)).toBe(false)
  })
})
