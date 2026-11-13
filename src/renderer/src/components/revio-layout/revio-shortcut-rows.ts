export type ShortcutRow = { id: string; title: string; group: string; keys: string }

/** Rows that match every typed word in their title, group or keys; unbound rows are left out. */
export function filterShortcutRows(rows: readonly ShortcutRow[], query: string): ShortcutRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    if (!row.keys) {
      return false
    }
    const haystack = `${row.title} ${row.group} ${row.keys}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
