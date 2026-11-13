import { migrateLegacyBrowserStorage } from './legacy-storage-key-migration'

// main.tsx imports this first: stores read their keys while their modules load.
migrateLegacyBrowserStorage()
