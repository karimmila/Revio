import { expect, it } from 'vitest'
import { expandPreviewUrl, normalizePreviewUrls } from './preview-urls'
import { IMPORTED_SCRIPT_ENV } from '../import-source-app'

it('fills in the workspace port, with offsets', () => {
  expect(expandPreviewUrl('http://localhost:$ORCA_PORT/app', 55010)).toBe(
    'http://localhost:55010/app'
  )
  expect(expandPreviewUrl(`http://localhost:\${${IMPORTED_SCRIPT_ENV.port}}`, 55010)).toBe(
    'http://localhost:55010'
  )
  expect(expandPreviewUrl('http://localhost:$((ORCA_PORT + 1))', 55010)).toBe(
    'http://localhost:55011'
  )
  expect(expandPreviewUrl(`http://localhost:$((${IMPORTED_SCRIPT_ENV.port} + 2))`, 55010)).toBe(
    'http://localhost:55012'
  )
  expect(expandPreviewUrl('https://staging.example.com', 55010)).toBe('https://staging.example.com')
})

it('keeps up to ten non-empty URLs', () => {
  expect(normalizePreviewUrls([' a ', '', 'b'])).toEqual(['a', 'b'])
  expect(normalizePreviewUrls(Array.from({ length: 12 }, (_, i) => `u${i}`))).toHaveLength(10)
})
