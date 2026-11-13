import React from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { FORK_PRODUCT_NAME } from '../../../../shared/fork-identity'

type Glyph = [number, number][][]

// Each letter is five rows of [startColumn, length] bars on a four-column grid. Only the letters
// of the current product name are drawn here.
const LETTERS: Partial<Record<string, Glyph>> = {
  O: [
    [[1, 2]],
    [
      [0, 1],
      [3, 1]
    ],
    [
      [0, 1],
      [3, 1]
    ],
    [
      [0, 1],
      [3, 1]
    ],
    [[1, 2]]
  ],
  R: [
    [[0, 3]],
    [
      [0, 1],
      [3, 1]
    ],
    [[0, 3]],
    [
      [0, 1],
      [2, 1]
    ],
    [
      [0, 1],
      [3, 1]
    ]
  ],
  E: [[[0, 4]], [[0, 1]], [[0, 3]], [[0, 1]], [[0, 4]]],
  V: [
    [
      [0, 1],
      [3, 1]
    ],
    [
      [0, 1],
      [3, 1]
    ],
    [
      [0.5, 1],
      [2.5, 1]
    ],
    [
      [1, 1],
      [2, 1]
    ],
    [[1.5, 1]]
  ],
  I: [[[0.5, 3]], [[1.5, 1]], [[1.5, 1]], [[1.5, 1]], [[0.5, 3]]]
}

const UNIT = 12
const BAR_HEIGHT = 9
const ROW_PITCH = 12
const LETTER_ADVANCE = 5 * UNIT

function productNameGlyphs(): Glyph[] | null {
  const glyphs: Glyph[] = []
  for (const letter of FORK_PRODUCT_NAME.toUpperCase()) {
    const glyph = LETTERS[letter]
    if (!glyph) {
      return null
    }
    glyphs.push(glyph)
  }
  return glyphs
}

/**
 * The product name drawn from short rounded bars, for the empty Home screen. A name with a letter
 * that has no glyph here renders as plain text, so a rename never leaves a blank or wrong mark.
 */
export function ProductBlockWordmark({ className }: { className?: string }): React.JSX.Element {
  const label = translate('auto.components.revioLayout.orcaWordmark', '{{productName}}')
  const glyphs = productNameGlyphs()
  if (!glyphs) {
    return <div className={cn('text-5xl font-bold tracking-tight', className)}>{label}</div>
  }
  const width = glyphs.length * LETTER_ADVANCE - UNIT
  const height = 4 * ROW_PITCH + BAR_HEIGHT
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={label}
      fill="currentColor"
    >
      {glyphs.flatMap((glyph, letterIndex) =>
        glyph.flatMap((row, rowIndex) =>
          row.map(([start, length]) => (
            <rect
              key={`${letterIndex}-${rowIndex}-${start}`}
              x={letterIndex * LETTER_ADVANCE + start * UNIT + 1}
              y={rowIndex * ROW_PITCH}
              width={length * UNIT - 2}
              height={BAR_HEIGHT}
              rx={1.5}
            />
          ))
        )
      )}
    </svg>
  )
}
