import { builtinRecipeCommand } from '../ephemeral-vm-builtin-recipes'
import type { OrcaVmRecipe } from '../orca-yaml-hook-types'

export const VERCEL_SANDBOX_HANDLER = 'vercel-sandbox'
export const VERCEL_CLOUD_RECIPE_ID = 'orca-cloud-vercel'

/** The recipe behind "Cloud" workspaces: one Vercel Sandbox per workspace, from the repo's build. */
export const VERCEL_CLOUD_RECIPE: OrcaVmRecipe = {
  id: VERCEL_CLOUD_RECIPE_ID,
  name: 'Cloud (Vercel Sandbox)',
  description: "One Vercel Sandbox per workspace, started from the repository's cloud build.",
  checkoutMode: 'provisioned-root',
  create: builtinRecipeCommand(VERCEL_SANDBOX_HANDLER, 'create'),
  suspend: builtinRecipeCommand(VERCEL_SANDBOX_HANDLER, 'suspend'),
  resume: builtinRecipeCommand(VERCEL_SANDBOX_HANDLER, 'resume'),
  destroy: builtinRecipeCommand(VERCEL_SANDBOX_HANDLER, 'destroy')
}
