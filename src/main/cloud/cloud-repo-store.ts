import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { writeSecureFile } from '../../shared/secure-file'
import {
  EMPTY_CLOUD_REPO_CONFIG,
  type CloudBuild,
  type CloudRepoConfig
} from '../../shared/cloud/cloud-types'

const MAX_BUILDS = 10
const MAX_LOG_READ = 512 * 1024

const BuildSchema = z.object({
  id: z.string(),
  state: z.enum(['running', 'succeeded', 'failed', 'canceled']),
  step: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  commit: z.string().nullable(),
  snapshotId: z.string().nullable(),
  error: z.string().nullable(),
  baseLayer: z.number().optional()
})

const RepoFileSchema = z.object({
  config: z.object({
    installScript: z.string(),
    setupScript: z.string(),
    wakeScript: z.string(),
    vcpus: z.number().nullable(),
    network: z.enum(['open', 'allowlist']).optional(),
    extraDomains: z.array(z.string()).optional()
  }),
  builds: z.array(BuildSchema)
})

type RepoFile = z.infer<typeof RepoFileSchema>

let rootDir: () => string = () => {
  throw new Error('Cloud data root is not set')
}

export function setCloudDataRoot(next: () => string): void {
  rootDir = next
}

export function cloudDataRoot(): string {
  return rootDir()
}

function repoFile(repoId: string): string {
  if (!/^[\w.-]+$/.test(repoId)) {
    throw new Error('Unknown repository')
  }
  return join(rootDir(), 'repos', `${repoId}.json`)
}

export function buildLogFile(buildId: string): string {
  if (!/^[\w-]+$/.test(buildId)) {
    throw new Error('Unknown build')
  }
  return join(rootDir(), 'logs', `${buildId}.log`)
}

export function readRepoFile(repoId: string): RepoFile {
  const file = repoFile(repoId)
  if (!existsSync(file)) {
    return { config: { ...EMPTY_CLOUD_REPO_CONFIG }, builds: [] }
  }
  const parsed = RepoFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  return parsed.success ? parsed.data : { config: { ...EMPTY_CLOUD_REPO_CONFIG }, builds: [] }
}

function writeRepoFile(repoId: string, next: RepoFile): void {
  writeSecureFile(repoFile(repoId), `${JSON.stringify(next, null, 2)}\n`)
}

export function writeCloudRepoConfig(repoId: string, config: CloudRepoConfig): void {
  writeRepoFile(repoId, { ...readRepoFile(repoId), config })
}

/** Inserts or replaces one build; history keeps the newest ten. */
export function saveCloudBuild(repoId: string, build: CloudBuild): CloudBuild[] {
  const current = readRepoFile(repoId)
  const builds = [build, ...current.builds.filter((entry) => entry.id !== build.id)]
    .toSorted((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_BUILDS)
  writeRepoFile(repoId, { ...current, builds })
  return builds
}

export function appendBuildLog(buildId: string, text: string): void {
  const file = buildLogFile(buildId)
  mkdirSync(join(rootDir(), 'logs'), { recursive: true, mode: 0o700 })
  appendFileSync(file, text, { mode: 0o600 })
}

/** The log's last 512 KB; long installs print far more than anyone scrolls through. */
export function readBuildLog(buildId: string): string {
  const file = buildLogFile(buildId)
  if (!existsSync(file)) {
    return ''
  }
  const text = readFileSync(file, 'utf8')
  return statSync(file).size > MAX_LOG_READ ? text.slice(-MAX_LOG_READ) : text
}
