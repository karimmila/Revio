import { describe, expect, it } from 'vitest'
import { ephemeralVmRecipeFailure } from './ephemeral-vm-failure-copy'

describe('ephemeralVmRecipeFailure', () => {
  it('shows the recipe’s own last stderr line instead of the exit code', () => {
    expect(
      ephemeralVmRecipeFailure(
        1,
        'Starting a sandbox from the build of 26a7da3\nVercel refused: Hobby plan usage limit exceeded for Snapshots Storage.\n'
      )
    ).toEqual({
      error: 'Vercel refused: Hobby plan usage limit exceeded for Snapshots Storage.',
      errorCode: 'recipeFailed',
      errorParams: {
        message: 'Vercel refused: Hobby plan usage limit exceeded for Snapshots Storage.'
      }
    })
  })

  it('falls back to the exit code when the recipe wrote nothing', () => {
    expect(ephemeralVmRecipeFailure(1, '\n').errorCode).toBe('recipeExited')
    expect(ephemeralVmRecipeFailure(null, undefined).errorCode).toBe('recipeExitedWithoutCode')
  })
})
