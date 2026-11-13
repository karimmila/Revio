/*
 * Status hook scripts live in ~/.orca/agent-hooks, and the entries in each agent's own settings
 * file point there. The upstream app keeps its hooks in the same folder under the same names, so
 * on a computer that has both apps an install here rewrites the other app's scripts, and a removal
 * here takes the other app's entries out. Until this app has a hooks folder of its own, the
 * packaged desktop app declares the hooks unavailable: nothing installs, rewrites or removes
 * them, and Settings hides the switch.
 */
let unavailable = false

/** An entry point that must leave the shared hooks alone calls this once, before it reads settings. */
export function declareAgentStatusHooksUnavailable(): void {
  unavailable = true
}

export function isAgentStatusHooksAvailable(): boolean {
  return !unavailable
}

/** Tests only: undo a declaration made earlier in the same process. */
export function resetAgentStatusHooksAvailabilityForTest(): void {
  unavailable = false
}
