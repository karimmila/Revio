// "I'm not absolutely right, thank you very much": the stock opener goes, the rest stays.
const OPENER = /^You['’]re absolutely right(?:!|\.|\s+[-–])?\s*/i

export function stripAbsolutelyRight(text: string): string {
  const stripped = text.replace(OPENER, '')
  if (stripped === text || stripped === '') {
    return stripped
  }
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
