import { IMPORT_SOURCE_PROVIDER } from '../import-source-app'

export const SETUP_SCRIPT_IMPORT_PROVIDERS = [
  'superset',
  IMPORT_SOURCE_PROVIDER,
  'codex',
  'cmux',
  'package-manager'
] as const

export type SetupScriptImportProvider = (typeof SETUP_SCRIPT_IMPORT_PROVIDERS)[number]
