import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { format } from 'node:util'
import { createBoundedLogFileWriter, type BoundedLogFileWriter } from './bounded-log-file-writer'
import { getLogsDirectory } from './logs-directory'
import { redactString } from './redactor'

/*
 * A packaged app has no terminal, so what main prints (warnings, caught failures, the fatal-error
 * record) was lost. This copies console output to logs/main.log: redacted, with the home folder
 * shortened to "~", rotated at 5 MB and kept to 5 files. Nothing here leaves the machine.
 */
const MAX_BYTES = 5 * 1024 * 1024
const MAX_FILES = 5
const BATCH_WINDOW_MS = 500
const MAX_LINE_CHARS = 16_384
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const

export function getMainLogFilePath(): string {
  return join(getLogsDirectory(), 'main.log')
}

/** One log line: time, level and the redacted message, cut to a bounded length. */
export function formatMainLogLine(
  level: string,
  args: readonly unknown[],
  options: { now: Date; home: string }
): string {
  let text = redactString(format(...args))
  if (options.home.length > 1) {
    text = text.split(options.home).join('~')
  }
  if (text.length > MAX_LINE_CHARS) {
    text = `${text.slice(0, MAX_LINE_CHARS)}… [truncated]`
  }
  return `${options.now.toISOString()} ${level.toUpperCase()} ${text}\n`
}

let installed: BoundedLogFileWriter | null = null

/** Starts copying main's console output to the log file. Safe to call twice; never throws. */
export function installMainConsoleLogFile(): void {
  if (installed) {
    return
  }
  try {
    const filePath = getMainLogFilePath()
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 })
    const writer = createBoundedLogFileWriter({
      filePath,
      maxBytes: MAX_BYTES,
      maxFiles: MAX_FILES,
      batchWindowMs: BATCH_WINDOW_MS,
      formatDroppedLine: (dropped) =>
        `${new Date().toISOString()} WARN [log] ${dropped} lines were dropped\n`
    })
    installed = writer
    const home = homedir()
    for (const level of LEVELS) {
      const original = console[level].bind(console)
      console[level] = (...args: unknown[]): void => {
        original(...args)
        try {
          writer.write(formatMainLogLine(level, args, { now: new Date(), home }))
        } catch {
          // A value that cannot be formatted must not break the caller's log call.
        }
      }
    }
    process.once('exit', () => writer.close())
  } catch {
    // Logging to a file is best effort; the app runs without it.
  }
}
