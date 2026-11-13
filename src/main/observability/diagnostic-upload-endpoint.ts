import { forkServiceUrl } from '../../shared/fork-services'

export function resolveDiagnosticBuildTokenEndpoint(): string | null {
  const endpoint =
    typeof ORCA_DIAGNOSTICS_TOKEN_URL !== 'undefined'
      ? ORCA_DIAGNOSTICS_TOKEN_URL
      : ((globalThis as { ORCA_DIAGNOSTICS_TOKEN_URL?: string | null })
          .ORCA_DIAGNOSTICS_TOKEN_URL ?? null)
  return typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : null
}

export function resolveDiagnosticBuildIdentity(): 'stable' | 'rc' | null {
  const ident =
    typeof ORCA_BUILD_IDENTITY !== 'undefined'
      ? ORCA_BUILD_IDENTITY
      : ((globalThis as { ORCA_BUILD_IDENTITY?: 'stable' | 'rc' | null }).ORCA_BUILD_IDENTITY ??
        null)
  return ident === 'stable' || ident === 'rc' ? ident : null
}

export function resolveDiagnosticTokenEndpoint(): string | null {
  // Uploads go only to the endpoint this fork names; no env fallback can redirect them.
  const forkEndpoint = forkServiceUrl('diagnosticsUploadUrl')
  if (!forkEndpoint) {
    return null
  }
  return resolveDiagnosticBuildTokenEndpoint() ?? forkEndpoint
}

export function resolveDiagnosticOrcaChannel(): 'stable' | 'rc' | 'dev' {
  const ident = resolveDiagnosticBuildIdentity()
  if (ident === 'stable' || ident === 'rc') {
    return ident
  }
  return 'dev'
}
