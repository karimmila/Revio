export type EphemeralVmRuntimeStoreErrorCode = 'invalid_argument' | 'runtime_error'

export class EphemeralVmRuntimeStoreError extends Error {
  readonly code: EphemeralVmRuntimeStoreErrorCode

  constructor(code: EphemeralVmRuntimeStoreErrorCode, message: string) {
    super(message)
    this.name = 'EphemeralVmRuntimeStoreError'
    this.code = code
  }
}
