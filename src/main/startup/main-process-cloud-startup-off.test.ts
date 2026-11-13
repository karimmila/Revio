import { beforeEach, describe, expect, it, vi } from 'vitest'

type StartupMocks = {
  pushCreate: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>
  relayConstructed: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>
  installerCreate: null | (() => unknown)
  state: {
    runtime: unknown
    desktopPushService: unknown
    initialProxyApplicationReady: Promise<void>
    isQuitting: boolean
    desktopRelayService: null
    desktopRelayInstaller: unknown
  }
}

const mocks = vi.hoisted((): StartupMocks => ({
  pushCreate: vi.fn(),
  relayConstructed: vi.fn(),
  installerCreate: null,
  state: {
    runtime: {},
    desktopPushService: undefined,
    initialProxyApplicationReady: Promise.resolve(),
    isQuitting: false,
    desktopRelayService: null,
    desktopRelayInstaller: null
  }
}))

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.0.0' },
  powerMonitor: { on: vi.fn() }
}))
vi.mock('../runtime/push/desktop-push-service', () => ({
  DesktopPushService: { create: mocks.pushCreate }
}))
vi.mock('../runtime/mobile-cloud-relay/desktop-relay-service', () => ({
  DesktopRelayService: class {
    constructor() {
      mocks.relayConstructed()
    }
  }
}))
vi.mock('../runtime/mobile-cloud-relay/desktop-relay-service-installer', () => ({
  createDesktopRelayServiceInstaller: (options: { create: () => unknown }) => {
    mocks.installerCreate = options.create
    return { ensure: vi.fn() }
  }
}))
vi.mock('../orca-profiles/profile-storage-paths', () => ({ getProfileUserDataPath: () => '/tmp' }))
vi.mock('./main-process-relay-status', () => ({ publishDesktopRelayStatus: vi.fn() }))
vi.mock('./main-process-state', () => ({ mainProcessState: mocks.state }))

import { startDesktopPushService } from './main-process-push-startup'
import { startDesktopRelayService } from './main-process-relay-startup'

describe('cloud startup with every hosted service off', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mocks.pushCreate.mockReset()
    mocks.relayConstructed.mockReset()
  })

  it('never creates the push service', () => {
    vi.stubEnv('ORCA_PUSH_GATEWAY_URL', 'https://push.example')
    startDesktopPushService({} as never)
    expect(mocks.pushCreate).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never creates the relay service', () => {
    vi.stubEnv('ORCA_CLOUD_API_URL', 'https://orca-cloud.example')
    vi.stubEnv('ORCA_RELAY_URL', 'https://relay.example')
    const runtimeRpc = { setMobileRelayPairingProviderInstaller: vi.fn() }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: startup only calls setMobileRelayPairingProviderInstaller before the relay gate
    startDesktopRelayService(runtimeRpc as never)
    expect(mocks.installerCreate?.()).toBeNull()
    expect(mocks.relayConstructed).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
