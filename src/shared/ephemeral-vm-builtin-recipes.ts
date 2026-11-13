import type { EphemeralVmRecipeContext } from './ephemeral-vm-recipe-runner'
import type { ProcessRunResult } from './ephemeral-vm-recipe-process'
import { FORK_PRODUCT_NAME } from './fork-identity'

/**
 * Recipes Orca ships itself. Their commands name a handler (`orca-builtin:<name> <mode>`) that
 * runs in the main process instead of a shell, so a provider can use sealed credentials without
 * passing them to a child process. Everything else about the recipe (records, sleep, cleanup,
 * the owned SSH target) is the same as for a recipe from .orca.yaml.
 */
export const BUILTIN_RECIPE_PREFIX = 'orca-builtin:'

export type BuiltinRecipeHandler = (args: {
  mode: 'create' | 'suspend' | 'resume' | 'destroy'
  context: EphemeralVmRecipeContext
  stdin?: string
  signal?: AbortSignal
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}) => Promise<ProcessRunResult>

const handlers = new Map<string, BuiltinRecipeHandler>()

export function registerBuiltinRecipeHandler(name: string, handler: BuiltinRecipeHandler): void {
  handlers.set(name, handler)
}

export function builtinRecipeCommand(name: string, mode: string): string {
  return `${BUILTIN_RECIPE_PREFIX}${name} ${mode}`
}

export function findBuiltinRecipeHandler(command: string): BuiltinRecipeHandler | null {
  if (!command.startsWith(BUILTIN_RECIPE_PREFIX)) {
    return null
  }
  const name = command.slice(BUILTIN_RECIPE_PREFIX.length).split(/\s+/)[0] ?? ''
  const handler = handlers.get(name)
  if (!handler) {
    throw new Error(`${FORK_PRODUCT_NAME} has no built-in recipe named ${name}`)
  }
  return handler
}

/** Orca's own recipes report a person-ready sentence on stderr; shell recipes keep the exit code. */
export function resumeFailureMessage(
  command: string | undefined,
  result: Pick<ProcessRunResult, 'stderr' | 'exitCode'>
): string {
  const last = result.stderr.trim().split('\n').pop()
  return command?.startsWith(BUILTIN_RECIPE_PREFIX) && last
    ? last
    : `Resume exited with code ${result.exitCode ?? 'unknown'}.`
}
