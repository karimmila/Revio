import { describe, expect, it, vi } from 'vitest'
import { FORK_IDENTITY, type ForkServices } from '../../shared/fork-identity'
import {
  allowsPlaintextOrcaCloudSession,
  getOrcaCloudAuthConfig,
  getOrcaPushGatewayUrl,
  getOrcaRelayDirectorUrl,
  isOrcaCloudDevAuthEnabled
} from './profile-cloud-auth-config'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

const LOGIN_ON: ForkServices = {
  ...FORK_IDENTITY.services,
  cloudLoginUrl: 'https://login.revio.example'
}

describe('cloud auth config', () => {
  it('is off by default, even when env vars name an endpoint', () => {
    const env = {
      ORCA_CLOUD_API_URL: 'https://orca-cloud.example',
      ORCA_CLOUD_CLIENT_ID: 'desktop-client',
      ORCA_RELAY_URL: 'https://relay.example',
      ORCA_PUSH_GATEWAY_URL: 'https://push.example'
    }
    expect(getOrcaCloudAuthConfig(env, true)).toMatchObject({ configured: false })
    expect(getOrcaCloudAuthConfig(env, false)).toMatchObject({ configured: false })
    expect(getOrcaRelayDirectorUrl(env, false)).toBeNull()
    expect(getOrcaPushGatewayUrl(env, false)).toBeNull()
  })

  it('uses the fork sign-in URL in packaged builds and leaves the relay off', () => {
    const state = getOrcaCloudAuthConfig({}, true, LOGIN_ON)
    expect(state).toMatchObject({
      configured: true,
      config: {
        apiBaseUrl: 'https://login.revio.example',
        sessionEndpoint: 'https://login.revio.example/v1/desktop/auth/session',
        relayDirectorUrl: null
      }
    })
  })

  it('lets ORCA_RELAY_URL redirect only a relay the fork runs', () => {
    const relayOn = { ...LOGIN_ON, relayBaseUrl: 'https://relay.revio.example' }
    expect(getOrcaRelayDirectorUrl({}, true, relayOn)).toBe('https://relay.revio.example')
    expect(
      getOrcaRelayDirectorUrl({ ORCA_RELAY_URL: 'http://localhost:9000' }, false, relayOn)
    ).toBe('http://localhost:9000')
  })

  it('rejects loopback HTTP endpoints in packaged builds', () => {
    expect(
      getOrcaCloudAuthConfig(
        {
          ORCA_CLOUD_API_URL: 'http://localhost:4100',
          ORCA_CLOUD_CLIENT_ID: 'desktop-client'
        },
        true,
        LOGIN_ON
      )
    ).toMatchObject({ configured: false })

    const httpsState = getOrcaCloudAuthConfig(
      {
        ORCA_CLOUD_API_URL: 'https://orca-cloud.example',
        ORCA_CLOUD_CLIENT_ID: 'desktop-client'
      },
      true,
      LOGIN_ON
    )
    expect(httpsState.configured).toBe(true)
  })

  it('rejects non-HTTPS non-loopback API URLs', () => {
    expect(
      getOrcaCloudAuthConfig(
        {
          ORCA_CLOUD_API_URL: 'http://orca-cloud.example',
          ORCA_CLOUD_CLIENT_ID: 'desktop-client'
        },
        false,
        LOGIN_ON
      )
    ).toMatchObject({ configured: false })
  })

  it('ignores dev flags in packaged builds even without NODE_ENV', () => {
    expect(allowsPlaintextOrcaCloudSession({ ORCA_CLOUD_ALLOW_PLAINTEXT_SESSION: '1' }, true)).toBe(
      false
    )
    expect(isOrcaCloudDevAuthEnabled({ ORCA_CLOUD_DEV_AUTH: '1' }, true)).toBe(false)
  })
})
