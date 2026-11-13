/**
 * What `CLAUDE_CODE_OAUTH_TOKEN` holds inside an Orca cloud sandbox; Vercel's firewall swaps in
 * the real token on requests to api.anthropic.com. Kept dependency-free: the sandbox's Orca server
 * reads it too.
 */
export const CLAUDE_PLACEHOLDER_TOKEN = `sk-ant-oat01-${'x'.repeat(95)}`
