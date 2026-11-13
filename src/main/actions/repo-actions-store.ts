import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  parseSharedActions,
  sharedActionsFileFor,
  type ActionRunMode,
  type RepoAction
} from '../../shared/actions/repo-actions'
import type { Repo } from '../../shared/repo-types'
import { isActionIcon, type ActionIconId } from '../../shared/actions/action-icons'
import { getAppEnvironment } from '../../shared/app-environment'

export type RepoActionsList = {
  actions: RepoAction[]
  runMode: ActionRunMode
  previewUrls: string[]
  sharedFile: string
  /** The same file relative to the repository root, as shown to the person. */
  sharedFileName: string
  sharedError: string | null
}

export const ActionSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  script: z.string().min(1).max(200_000),
  targets: z.array(z.enum(['local', 'cloud', 'mirror'])).max(3),
  shared: z.boolean(),
  icon: z.custom<ActionIconId>(isActionIcon).optional()
})

export function personalFile(repoId: string): string {
  if (!/^[\w.-]+$/.test(repoId)) {
    throw new Error('Unknown repository')
  }
  return join(getAppEnvironment().getPath('userData'), 'actions', `${repoId}.json`)
}

export const RunModeSchema = z.enum(['concurrent', 'nonconcurrent'])
export const PreviewUrlsSchema = z.array(z.string().max(2048)).max(10)

type PersonalActions = { actions: RepoAction[]; runMode: ActionRunMode; previewUrls: string[] }

// Older files hold the bare action array; the object form adds the repository's run mode.
const PersonalFileSchema = z.union([
  z
    .array(ActionSchema)
    .transform((actions) => ({ actions, runMode: undefined, previewUrls: undefined })),
  z.object({
    actions: z.array(ActionSchema),
    runMode: RunModeSchema.optional(),
    previewUrls: PreviewUrlsSchema.optional()
  })
])

export function readPersonal(repoId: string): PersonalActions {
  const file = personalFile(repoId)
  if (!existsSync(file)) {
    return { actions: [], runMode: 'concurrent', previewUrls: [] }
  }
  const parsed = PersonalFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  return parsed.success
    ? {
        actions: parsed.data.actions.map((action) => ({ ...action, shared: false })),
        runMode: parsed.data.runMode ?? 'concurrent',
        previewUrls: parsed.data.previewUrls ?? []
      }
    : { actions: [], runMode: 'concurrent', previewUrls: [] }
}

/**
 * A repository's actions: shared ones from its actions file, then personal ones kept in
 * Orca's data folder. The Settings page, the Run button and agents' `orca action` all read this.
 */
export function readRepoActions(repo: Pick<Repo, 'id' | 'path'>): RepoActionsList {
  const sharedFileName = sharedActionsFileFor((file) => existsSync(join(repo.path, file)))
  const sharedFile = join(repo.path, sharedFileName)
  let shared: RepoAction[] = []
  let sharedError: string | null = null
  if (existsSync(sharedFile)) {
    try {
      shared = parseSharedActions(readFileSync(sharedFile, 'utf8'))
    } catch (error) {
      sharedError = error instanceof Error ? error.message : String(error)
    }
  }
  const personal = readPersonal(repo.id)
  return {
    actions: [...shared, ...personal.actions],
    runMode: personal.runMode,
    previewUrls: personal.previewUrls,
    sharedFile,
    sharedFileName,
    sharedError
  }
}
