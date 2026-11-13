import { expect, it } from 'vitest'
import { parseEnvFile } from './env-file-parse'

it('reads dotenv lines', () => {
  expect(
    parseEnvFile(
      [
        '# comment',
        'A=1',
        'export B = two # note',
        'C="quoted # kept\\nnext"',
        "D='single'",
        'bad line',
        'E='
      ].join('\n')
    )
  ).toEqual({ A: '1', B: 'two', C: 'quoted # kept\nnext', D: 'single', E: '' })
})
