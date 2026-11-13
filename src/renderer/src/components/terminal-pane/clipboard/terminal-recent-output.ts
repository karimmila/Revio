/**
 * Lines the workspace layout's "Attach current terminal output" sends: enough for an error and its
 * context.
 */
export const ATTACHED_OUTPUT_MAX_LINES = 200

/** The last lines of a terminal buffer, without the blank rows below the prompt. */
export function recentTerminalOutput(
  lines: readonly string[],
  max = ATTACHED_OUTPUT_MAX_LINES
): string {
  let end = lines.length
  while (end > 0 && !lines[end - 1]?.trim()) {
    end -= 1
  }
  return lines
    .slice(Math.max(0, end - max), end)
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
}

type BufferLike = {
  length: number
  getLine: (index: number) => { translateToString: (trimRight?: boolean) => string } | undefined
}

/**
 * Reads the last rows of an xterm buffer (scrollback included) as text. A margin over the line cap
 * leaves room for blank rows under the prompt without walking a 50k-row scrollback.
 */
export function terminalBufferLines(
  buffer: BufferLike,
  last = ATTACHED_OUTPUT_MAX_LINES * 5
): string[] {
  const lines: string[] = []
  for (let index = Math.max(0, buffer.length - last); index < buffer.length; index += 1) {
    lines.push(buffer.getLine(index)?.translateToString(true) ?? '')
  }
  return lines
}
