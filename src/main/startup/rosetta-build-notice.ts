import { app, dialog } from 'electron'
import { translateMain } from '../i18n/main-i18n'

/** Whether this is the Intel build running through Rosetta on Apple silicon. */
export function runsUnderRosetta(
  platform: NodeJS.Platform,
  runningUnderArm64Translation: boolean
): boolean {
  return platform === 'darwin' && runningUnderArm64Translation
}

/**
 * "Wrong version for this Mac": the Intel build under Rosetta runs slower
 * and its agents and tools take the wrong architecture, so say which build to install.
 */
export function showRosettaBuildNotice(): void {
  if (!runsUnderRosetta(process.platform, app.runningUnderARM64Translation)) {
    return
  }
  void dialog.showMessageBox({
    type: 'warning',
    message: translateMain(
      'startup.rosetta.title',
      'Wrong version of {{productName}} for this Mac'
    ),
    detail: translateMain(
      'startup.rosetta.detail',
      'This is the Intel version running through Rosetta. Download the Apple silicon version for full speed.'
    ),
    buttons: [translateMain('startup.rosetta.ok', 'OK')]
  })
}
