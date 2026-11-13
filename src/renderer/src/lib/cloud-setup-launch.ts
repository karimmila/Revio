/**
 * A new cloud workspace's setup script (left in the sandbox by Orca's cloud provider) runs in
 * its "Setup" tab, like a Mac workspace's setup, so creation does not wait for it.
 */
export async function withCloudSetup<T extends { setup?: unknown }>(
  environmentId: string,
  result: T
): Promise<T> {
  if (result.setup || !window.api.cloud?.setupLaunch) {
    return result
  }
  // Setup opens in the bottom panel, which reaches the sandbox over its ssh route.
  const [setup] = await Promise.all([
    window.api.cloud.setupLaunch(environmentId).catch(() => null),
    // Imported on use: the store's create slice loads this file, and the dock module reads the store.
    import('@/components/revio-layout/revio-cloud-dock').then((dock) =>
      dock.prepareCloudDock(environmentId)
    )
  ])
  return setup ? { ...result, setup } : result
}
