import type { OrcaVmRecipe } from '../../shared/orca-yaml-hook-types'
import type { PluginService } from './plugin-service'
import { VERCEL_CLOUD_RECIPE } from '../../shared/cloud/cloud-recipe'

export async function getApprovedPluginVmRecipes(
  pluginService?: PluginService
): Promise<OrcaVmRecipe[]> {
  // Orca's own cloud recipe rides beside approved plugin recipes; a repo's .orca.yaml can still shadow it by id.
  if (!pluginService) {
    return [VERCEL_CLOUD_RECIPE]
  }
  await pluginService.whenReady()
  return [
    ...pluginService.contentPacks.vmRecipes.list().map(({ recipe }) => recipe),
    VERCEL_CLOUD_RECIPE
  ]
}
