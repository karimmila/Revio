import type { EmulatorBackend, EmulatorBackendKind } from './backends/emulator-backend'

export async function selectBackendForDevice(
  backends: readonly EmulatorBackend[],
  registered: { backend: EmulatorBackendKind } | undefined,
  device: string,
  hostDefault: EmulatorBackend
): Promise<EmulatorBackend> {
  for (const backend of backends) {
    if (registered ? backend.kind === registered.backend : await backend.ownsDevice(device)) {
      return backend
    }
  }
  // Choose the host's backend so unknown devices produce the relevant setup error.
  return backends.find((backend) => backend.isSupportedOnHost()) ?? hostDefault
}
