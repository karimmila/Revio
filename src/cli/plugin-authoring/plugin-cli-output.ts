import { isAbsolute, resolve } from 'node:path'
import type { HandlerContext } from '../dispatch'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError } from '../runtime/types'
import { writeStdoutLine } from '../stdout-line'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/** One `{ ok, result }` object on stdout for --json; plain text otherwise. */
export function printPluginResult(ctx: HandlerContext, result: unknown, text: string): void {
  writeStdoutLine(ctx.json ? JSON.stringify({ ok: true, result }, null, 2) : text)
}

export function requirePluginPathArg(ctx: HandlerContext, flag: string): string {
  const value = ctx.flags.get(flag)
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RuntimeClientError('invalid_argument', `Missing <${flag}>.`)
  }
  return value
}

/**
 * Authoring commands read and write the files of the machine that runs them. Why refuse a bridged
 * shell: there the CLI runs on the Orca host, so the caller's paths would name the wrong machine.
 */
export function resolveLocalPluginPath(
  ctx: HandlerContext,
  value: string,
  command: string
): string {
  rejectRemoteSelectionFlags(
    ctx.flags,
    `${FORK_CLI_COMMAND_NAME} plugin ${command}; it works on local files`
  )
  if (process.env.ORCA_CLI_CWD) {
    throw new RuntimeClientError(
      'invalid_environment',
      `${FORK_CLI_COMMAND_NAME} plugin ${command} works on the files of the machine that runs it, but this shell forwards ${FORK_CLI_COMMAND_NAME} to the ${FORK_PRODUCT_NAME} host. Write and check the plugin files on this machine directly, or run the command on the ${FORK_PRODUCT_NAME} host.`
    )
  }
  return isAbsolute(value) ? value : resolve(ctx.cwd, value)
}
