import { rmdirSync, unlinkSync } from 'node:fs'

export function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export function removeOwnerEntry(path: string): void {
  try {
    unlinkSync(path)
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      throw error
    }
  }
}

export function removeEmptyOwnerDirectory(path: string): void {
  try {
    rmdirSync(path)
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY'].some((code) => hasCode(error, code))) {
      throw error
    }
  }
}
