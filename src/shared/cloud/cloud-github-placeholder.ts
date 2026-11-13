/**
 * What `GH_TOKEN` holds inside a cloud sandbox, so `gh` sends an Authorization header at all;
 * Vercel's firewall replaces it with the real token on REST requests for the sandbox's own
 * repository. It is not a credential. Kept dependency-free: the sandbox's own server reads it too.
 */
export const GH_PLACEHOLDER_TOKEN = 'github_pat_orca_placeholder_the_firewall_adds_the_real_token'

/** True inside a cloud sandbox: its environment carries the placeholder, never a real token. */
export function hasSandboxGithubPlaceholder(env: NodeJS.ProcessEnv): boolean {
  return env.GH_TOKEN === GH_PLACEHOLDER_TOKEN
}
