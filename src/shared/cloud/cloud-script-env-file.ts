/**
 * Where a cloud workspace keeps the values its repo marked "Send to cloud" (all of them unless a
 * variable was opted into /etc/environment). Only the setup, wake and Run action scripts read it,
 * so agents and terminal sessions do not inherit those keys. The build deletes it before its
 * snapshot.
 */
export const CLOUD_SCRIPT_ENV_FILE = '/vercel/.orca-cloud-script-env'

/** The line a sandbox script starts with to pick up those values; a no-op where the file is absent. */
export const SOURCE_CLOUD_SCRIPT_ENV = `[ -f ${CLOUD_SCRIPT_ENV_FILE} ] && . ${CLOUD_SCRIPT_ENV_FILE}`
