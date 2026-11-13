import { z } from 'zod'
import type { GithubRepoRef } from '../../shared/cloud/github-remote'
import type { GithubGet } from './github-app-api'

/**
 * Which repositories the app and the signed-in person can both reach: GitHub lists the person's
 * installations of this app, and each installation's repositories that the person can access.
 */
export type GithubCoverage = {
  /** "owner/name", lower case. */
  repos: Set<string>
  /** Accounts with the app installed, by lower-case login. */
  installedOwners: Map<string, number>
  /** The same repositories as GitHub spells them, for lists the person reads. */
  listed?: { owner: string; name: string; isPrivate: boolean }[]
  checkedAt: number
}

const PER_PAGE = 100
// 50 × 100: a person with more installed repositories than this is far outside cloud's use.
const MAX_PAGES = 50

const InstallationsPage = z.object({
  total_count: z.number(),
  installations: z.array(
    z.object({
      id: z.number(),
      account: z.object({ login: z.string(), id: z.number() }).nullable()
    })
  )
})
const ReposPage = z.object({
  total_count: z.number(),
  repositories: z.array(
    z.object({
      name: z.string(),
      owner: z.object({ login: z.string() }),
      private: z.boolean().optional()
    })
  )
})

async function readJson(get: GithubGet, path: string): Promise<unknown> {
  const response = await get(path)
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} while listing the app's access.`)
  }
  return response.json()
}

/** Every page of a GitHub list, until a short page or the stated total. */
export async function readAllPages<T>(
  get: GithubGet,
  path: string,
  pick: (body: unknown) => { total: number; items: T[] }
): Promise<T[]> {
  const items: T[] = []
  const join = path.includes('?') ? '&' : '?'
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { total, items: batch } = pick(
      await readJson(get, `${path}${join}per_page=${PER_PAGE}&page=${page}`)
    )
    items.push(...batch)
    if (batch.length < PER_PAGE || items.length >= total) {
      break
    }
  }
  return items
}

export async function readGithubCoverage(
  get: GithubGet,
  now = Date.now()
): Promise<GithubCoverage> {
  const installations = await readAllPages(get, '/user/installations', (body) => {
    const page = InstallationsPage.parse(body)
    return { total: page.total_count, items: page.installations }
  })
  const repos = new Set<string>()
  const installedOwners = new Map<string, number>()
  const names: NonNullable<GithubCoverage['listed']> = []
  for (const installation of installations) {
    if (installation.account) {
      installedOwners.set(installation.account.login.toLowerCase(), installation.account.id)
    }
    const listed = await readAllPages(
      get,
      `/user/installations/${installation.id}/repositories`,
      (body) => {
        const page = ReposPage.parse(body)
        return { total: page.total_count, items: page.repositories }
      }
    )
    for (const repo of listed) {
      repos.add(`${repo.owner.login}/${repo.name}`.toLowerCase())
      names.push({ owner: repo.owner.login, name: repo.name, isPrivate: repo.private === true })
    }
  }
  return { repos, installedOwners, listed: names, checkedAt: now }
}

export function isRepoCovered(coverage: GithubCoverage, repo: GithubRepoRef): boolean {
  return coverage.repos.has(`${repo.owner}/${repo.name}`.toLowerCase())
}

const UserSchema = z.object({ id: z.number() })

/** The owner's numeric id, so the install page opens on that account; null when unknown. */
export async function githubOwnerId(get: GithubGet, owner: string): Promise<number | null> {
  try {
    const response = await get(`/users/${encodeURIComponent(owner)}`)
    if (!response.ok) {
      return null
    }
    const parsed = UserSchema.safeParse(await response.json())
    return parsed.success ? parsed.data.id : null
  } catch {
    return null
  }
}
