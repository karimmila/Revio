/**
 * Install rows for plugins from Orca's public catalogs, which feed the directory's install counts.
 * Anything else (private catalogs, git, local and dev installs) never reports.
 */
import {
  isCommunityCatalogUrl,
  isOfficialCatalogUrl
} from '../../shared/plugins/catalog/plugin-default-catalogs'
import type { EventProps } from '../../shared/telemetry-events'
import { track } from './client'

export type PluginInstallTelemetryProps = EventProps<'plugin_installed'>
export type PluginInstallTrigger = PluginInstallTelemetryProps['trigger']
type Catalog = PluginInstallTelemetryProps['catalog']

/** The public catalog a marketplace URL names, or null for any other catalog. */
export function pluginTelemetryCatalog(marketplaceUrl: string): Catalog | null {
  if (isOfficialCatalogUrl(marketplaceUrl)) {
    return 'official'
  }
  return isCommunityCatalogUrl(marketplaceUrl) ? 'community' : null
}

export function pluginInstallKind(
  priorVersion: string | null,
  version: string
): PluginInstallTelemetryProps['kind'] {
  if (priorVersion === null) {
    return 'install'
  }
  return priorVersion === version ? 'reinstall' : 'update'
}

export function trackPluginInstalled(
  input: Omit<PluginInstallTelemetryProps, 'catalog'> & { marketplaceUrl: string }
): void {
  const { marketplaceUrl, ...rest } = input
  const catalog = pluginTelemetryCatalog(marketplaceUrl)
  if (catalog) {
    safeTrack(() => track('plugin_installed', { ...rest, catalog }))
  }
}

function safeTrack(emit: () => void): void {
  try {
    // track() applies the consent gate and validates against the strict schema.
    emit()
  } catch {
    // Telemetry never costs an install.
  }
}
