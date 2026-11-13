import type { Sandbox } from '@vercel/sandbox'
import { runSandboxScript } from './cloud-sandbox-run'

/**
 * Marks Claude Code's first run done for the sandbox user, keeping any choice already made, and
 * answers "No" for a sent ANTHROPIC_API_KEY (its trimmed last 20 characters, as Claude records
 * them in ORCA_REJECTED_KEY_TAIL), so the terminal agent signs in with the Claude token as
 * Orca's cloud chats do instead of stopping on "Detected a custom API key".
 */
export const CLAUDE_FIRST_RUN_DONE = `python3 - <<'PY'
import json, os
path = os.path.expanduser('~/.claude.json')
try:
    config = json.load(open(path))
except Exception:
    config = {}
config.setdefault('hasCompletedOnboarding', True)
config.setdefault('theme', 'dark')
tail = os.environ.get('ORCA_REJECTED_KEY_TAIL', '')
if tail:
    responses = config.setdefault('customApiKeyResponses', {'approved': [], 'rejected': []})
    if tail not in responses.setdefault('approved', []) and tail not in responses.setdefault('rejected', []):
        responses['rejected'].append(tail)
json.dump(config, open(path, 'w'))
PY`
/** Vercel's allowlist only passes TLS, and Ubuntu's sources are plain http by default. */
export const APT_OVER_HTTPS =
  "sed -i 's#http://\\(archive\\|security\\|ports\\).ubuntu.com#https://\\1.ubuntu.com#g' /etc/apt/sources.list.d/*.sources 2>/dev/null || true"

/**
 * A fresh sandbox's first `claude` stopped on Claude Code's first-run screens, so the agent the
 * create launched sat waiting (seen 2026-11-09).
 */
export async function markClaudeFirstRunDone(
  sandbox: Sandbox,
  sentApiKey: string | undefined,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = sentApiKey?.trim()
  await runSandboxScript(sandbox, CLAUDE_FIRST_RUN_DONE, {
    env: apiKey ? { ORCA_REJECTED_KEY_TAIL: apiKey.slice(-20) } : {},
    signal
  })
}
