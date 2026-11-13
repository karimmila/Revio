import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n/main-i18n', () => ({
  translateMain: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace('{{status}}', values?.status ?? '')
}))

import { FORK_IDENTITY } from '../../shared/fork-identity'
import { createGpuAccelerationAboutPanelOptions } from './gpu-acceleration-about-panel'

describe('About panel', () => {
  it('credits upstream Orca above the copyright notice', () => {
    const options = createGpuAccelerationAboutPanelOptions({
      appName: 'Revio',
      appVersion: '1.0.0',
      platform: 'darwin',
      gpuFallbackActive: false,
      gpuFeatureStatus: { gpu_compositing: 'enabled' }
    })
    expect(options.copyright).toBe(
      `${FORK_IDENTITY.basedOnNotice}\n${FORK_IDENTITY.copyrightNotice}`
    )
    expect(FORK_IDENTITY.basedOnNotice).toBe('Based on Orca by Lovecast Inc., MIT License')
    expect(options.credits).toBe('GPU acceleration: Enabled')
  })
})
