import { useEffect, useState } from 'react'

let known: boolean | null = null

/** Whether the other app's data is on this Mac; settings only list Import when it is. */
export function useImportSourceAvailable(): boolean {
  const [available, setAvailable] = useState(known ?? false)
  useEffect(() => {
    let live = true
    void window.api.workspaceImport
      ?.available()
      .then((found) => {
        known = found
        if (live) {
          setAvailable(found)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return available
}
