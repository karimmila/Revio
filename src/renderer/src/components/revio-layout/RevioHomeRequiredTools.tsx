import { RequiredToolsNotice } from '@/components/required-tools/RequiredToolsNotice'
import {
  missingRequiredTools,
  useRequiredToolsCheck
} from '@/components/required-tools/required-tools-check'

/** Above the Home list: the command-line tools this Mac still lacks, each with its install command. */
export function RevioHomeRequiredTools(): React.JSX.Element | null {
  const check = useRequiredToolsCheck()
  if (missingRequiredTools(check.presence).length === 0) {
    return null
  }
  return (
    <div className="shrink-0 px-4 pt-3">
      <RequiredToolsNotice check={check} />
    </div>
  )
}
