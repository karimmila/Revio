import { describe, expect, it } from 'vitest'
import { FORK_IDENTITY } from '../../../shared/fork-identity'
import { resolveConnectorOrigin } from '../../connector-cloud/connector-origin'
import { resolvePushGatewayOrigin } from './push-gateway-origin'

const ENV = {
  ORCA_PUSH_GATEWAY_URL: 'https://push.example',
  ORCA_CONNECTOR_URL: 'https://connector.example'
}

describe('push gateway and connector origins', () => {
  it('are off by default, and env vars cannot turn them on', () => {
    expect(resolvePushGatewayOrigin({}, true)).toBeNull()
    expect(resolvePushGatewayOrigin(ENV, false)).toBeNull()
    expect(resolveConnectorOrigin({}, true)).toBeNull()
    expect(resolveConnectorOrigin(ENV, false)).toBeNull()
  })

  it('use the fork origins when on, and let dev env vars redirect them', () => {
    const services = {
      ...FORK_IDENTITY.services,
      pushGatewayUrl: 'https://push.revio.example',
      connectorUrl: 'https://connector.revio.example'
    }
    expect(resolvePushGatewayOrigin({}, true, services)).toBe('https://push.revio.example')
    expect(resolveConnectorOrigin({}, true, services)).toBe('https://connector.revio.example')
    expect(resolvePushGatewayOrigin(ENV, false, services)).toBe('https://push.example')
    expect(resolvePushGatewayOrigin(ENV, true, services)).toBe('https://push.example')
  })
})
