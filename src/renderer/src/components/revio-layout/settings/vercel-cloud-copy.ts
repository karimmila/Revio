import { translate } from '@/i18n/i18n'

/** Shown in place of an empty team list, which otherwise is a menu with nothing to pick. */
export function vercelNoTeamsText(): string {
  return translate(
    'auto.components.revioLayout.settings.vercelNoTeams',
    'This Vercel sign-in reaches no team. Create a team at vercel.com (a free Hobby account works), then press Check again.'
  )
}
