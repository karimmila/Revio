export const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g

// i18next fills these from interpolation.defaultVariables (src/shared/orca-i18n-instance.ts) on every
// call, so a translation may name the product or its command any number of times, or not at all.
const GLOBAL_PLACEHOLDERS = new Set([
  '{{productName}}',
  '{{cliCommand}}',
  '{{urlScheme}}',
  '{{envPrefix}}'
])

export const withoutGlobalPlaceholders = (variables) =>
  variables.filter((variable) => !GLOBAL_PLACEHOLDERS.has(variable))

export function collectInterpolationVariables(value) {
  if (typeof value === 'string') {
    const matches = value.match(PLACEHOLDER_RE) ?? []
    return [...matches].sort()
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return []
  }
  return Object.values(value).flatMap((child) => collectInterpolationVariables(child))
}

export function normalizeInterpolationVariables(value) {
  return collectInterpolationVariables(value)
    .map((variable) => variable.slice(2, -2))
    .join('|')
}
