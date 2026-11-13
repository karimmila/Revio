import { i18n, translate } from '@/i18n/i18n'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'

export type SearchKeywordSpec = {
  key: string
  fallback: string
  /** Extra English aliases kept when UI is localized (brands, acronyms). */
  aliases?: string[]
  /** When true, only the fallback/aliases are indexed — no localized variant. */
  englishOnly?: boolean
}

// Index localized copy alongside English aliases users still type.
export function translateSearchKeyword(
  key: string,
  fallback: string,
  options?: Omit<SearchKeywordSpec, 'key' | 'fallback'>
): string[] {
  const english = withProductNames(fallback)
  if (options?.englishOnly || i18n.language === 'en') {
    return uniqueKeywords([english, ...(options?.aliases ?? [])])
  }

  const localized = translate(key, fallback)
  return uniqueKeywords([localized, english, ...(options?.aliases ?? [])])
}

// English keywords skip the catalog, so the product placeholders are filled in here.
function withProductNames(keyword: string): string {
  return keyword
    .replaceAll('{{productName}}', FORK_PRODUCT_NAME)
    .replaceAll('{{cliCommand}}', FORK_CLI_COMMAND_NAME)
}

export function searchKeywords(terms: (string | SearchKeywordSpec)[]): string[] {
  return uniqueKeywords(
    terms.flatMap((term) => {
      if (typeof term === 'string') {
        return [term]
      }
      return translateSearchKeyword(term.key, term.fallback, term)
    })
  )
}

export function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}
