/**
 * Set in every cloud sandbox's /etc/environment, so the server that runs there knows it is inside
 * a sandbox. Dependency-free: that server reads it too.
 */
export const CLOUD_SANDBOX_ENV = 'ORCA_CLOUD_SANDBOX'
