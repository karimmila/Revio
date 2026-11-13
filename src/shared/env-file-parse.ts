/** Parses a dotenv file: `KEY=value`, optional `export`, quotes and `#` comments. */
export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw)
    if (!match) {
      continue
    }
    const [, name = '', rest = ''] = match
    const value = rest.trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.lastIndexOf(quote) > 0) {
      const inner = value.slice(1, value.lastIndexOf(quote))
      env[name] = quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\"/g, '"') : inner
    } else {
      env[name] = value.replace(/\s+#.*$/, '')
    }
  }
  return env
}
