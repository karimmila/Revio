// The prompt snippets: saved prompts a chat inserts with ⌘; ("Insert snippet").

export type RevioPromptSnippet = {
  id: string
  name: string
  /** Typed after `;` to name the snippet; letters only, no spaces or semicolons. */
  keyword: string
  body: string
}

export const SNIPPET_NAME_MAX = 80
export const SNIPPET_KEYWORD_MAX = 32
export const SNIPPET_BODY_MAX = 20_000

export function snippetKeyword(value: string): string {
  return value.replace(/[\s;]/g, '').slice(0, SNIPPET_KEYWORD_MAX)
}

/** Keyword matches first, then name, then body; an empty query lists every snippet by name. */
export function filterSnippets(
  snippets: readonly RevioPromptSnippet[],
  query: string
): RevioPromptSnippet[] {
  const q = query.trim().replace(/^;/, '').toLowerCase()
  const byName = [...snippets].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) {
    return byName
  }
  const rank = (snippet: RevioPromptSnippet): number =>
    snippet.keyword.toLowerCase().startsWith(q)
      ? 0
      : snippet.name.toLowerCase().includes(q)
        ? 1
        : snippet.body.toLowerCase().includes(q)
          ? 2
          : 3
  return byName.filter((snippet) => rank(snippet) < 3).sort((a, b) => rank(a) - rank(b))
}

/** A new or edited snippet replaces the one with its id; a keyword stays unique. */
export function saveSnippet(
  snippets: readonly RevioPromptSnippet[],
  next: RevioPromptSnippet
): RevioPromptSnippet[] | 'keyword-taken' {
  if (
    next.keyword &&
    snippets.some((snippet) => snippet.id !== next.id && snippet.keyword === next.keyword)
  ) {
    return 'keyword-taken'
  }
  const index = snippets.findIndex((snippet) => snippet.id === next.id)
  return index === -1
    ? [...snippets, next]
    : snippets.map((snippet) => (snippet.id === next.id ? next : snippet))
}
