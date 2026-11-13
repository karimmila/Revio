/**
 * One `[cloud] create <phase>: N s` line. The cloud recipe, main and the renderer all write them
 * into the creation log; the setup checklist advances on them (cloud-setup-steps.ts), so phase
 * names here must match its table.
 */
export function cloudCreateTimingLine(phase: string, startedAt: number, now = Date.now()): string {
  return `[cloud] create ${phase}: ${((now - startedAt) / 1000).toFixed(1)} s\n`
}
