/**
 * The two fixed parts of the line a cloud workspace's dock tab runs on this Mac. The dock builds
 * the line with them, and Quit reads them back from the process list to tell the app's own
 * sessions from programs the person started.
 */

/**
 * Ends an ssh session whose route never answers; the dock's ssh carries these right after `-t`.
 * ConnectTimeout also bounds the banner wait through the WebSocket ProxyCommand.
 */
export const CLOUD_DOCK_SSH_OPTIONS =
  '-o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4'

/** What the tab's shell becomes once ssh ends, so the tab keeps its log and shows no prompt. */
export const CLOUD_DOCK_CLOSED_COMMAND = 'sleep 2147483647'
