import type { RevioLayoutSettings } from './revio-layout-settings-types'

/** The Orca fork ships with the workspace layout on; its settings start at the defaults. */
export const REVIO_LAYOUT_DEFAULT_SETTINGS = {
  revioLayout: true,
  revioSendWithModEnter: false,
  revioPasteLongTextAsAttachment: true,
  revioExpandToolCalls: false,
  revioStripAbsolutelyRight: false,
  revioAlwaysShowContextUsage: false,
  revioDefaultPlanMode: false,
  revioDeleteBranchOnArchive: false,
  revioRenameWorkspaceWithBranch: true,
  revioArchiveOnMerge: false,
  revioAutoMerge: false,
  revioOptionalChecksBlocking: false,
  revioOpenPullRequestsIn: 'github',
  revioPrWorkspaceLink: false,
  revioSetUpstreamOnPush: true,
  revioStackedPullRequests: true,
  revioLocation: 'local',
  revioCloudIdleMinutes: 20,
  revioReviewModel: '',
  revioGraphiteStacks: true,
  revioStatusMatrix: false,
  revioSidebarSections: [],
  revioWorkspaceSections: {}
} satisfies RevioLayoutSettings
