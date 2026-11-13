/**
 * Whether two texts differ only in each line's leading or trailing whitespace: what a diff that
 * ignores trim whitespace (Orca's default) shows as no change at all.
 */
export function differsOnlyInWhitespace(original: string, modified: string): boolean {
  if (original === modified) {
    return false
  }
  const lines = (text: string): string[] => text.split(/\r?\n/u).map((line) => line.trim())
  const before = lines(original)
  const after = lines(modified)
  return before.length === after.length && before.every((line, index) => line === after[index])
}
