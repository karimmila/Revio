import { describe, expect, it } from 'vitest'
import { renameHtmlTitle } from '../../build-plugins/fork-html-title'

describe('renameHtmlTitle', () => {
  it('renames the product in the page title only', () => {
    const html = '<head><title>Orca Agent Dashboard</title></head><body>Orca</body>'
    expect(renameHtmlTitle(html, 'Revio Dev')).toBe(
      '<head><title>Revio Dev Agent Dashboard</title></head><body>Orca</body>'
    )
  })
})
