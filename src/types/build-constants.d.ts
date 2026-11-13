// ORCA_POSTHOG_WRITE_KEY is fork-identity.json services.telemetryWriteKey (null by default) and
// ORCA_BUILD_IDENTITY comes from CI; both must be set to transmit. No env fallback for the key.
declare const ORCA_BUILD_IDENTITY: 'stable' | 'rc' | null
declare const ORCA_POSTHOG_WRITE_KEY: string | null

// fork-identity.json services.diagnosticsUploadUrl; null (the default) disables diagnostic uploads.
declare const ORCA_DIAGNOSTICS_TOKEN_URL: string | null

// Full commit the build was made from (`git rev-parse HEAD`); official skill installs pin to it.
declare const ORCA_BUILD_COMMIT: string

// ORCA_LAYOUT_OWNER is declared and read in one place: src/shared/layout-owner-switch.ts.
