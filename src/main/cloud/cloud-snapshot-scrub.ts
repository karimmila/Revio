import { CLOUD_SCRIPT_ENV_FILE } from '../../shared/cloud/cloud-script-env-file'

/**
 * Run in the build's checkout just before its snapshot. Every workspace of the repository starts
 * from that snapshot, and anyone with access to the Vercel account can read it, so credentials an
 * install script wrote must not ride along: untracked `.env*` files (tracked ones such as `.env.example`
 * stay), npm, yarn and pip credentials, the GitHub CLI's login, and Orca's script-env file. The
 * snapshot keeps no expiry (`expiration: 0`) until the next build of the repository replaces it.
 */
export const SNAPSHOT_SCRUB_SCRIPT = `set -u
for ignored in --ignored ''; do
  git ls-files -z --others $ignored --exclude-standard -- ':(glob)**/.env*' \\
    ':(exclude,glob)**/node_modules/**' 2>/dev/null | xargs -0 -r rm -f --
done
rm -rf "$HOME/.npmrc" "$HOME/.yarnrc" "$HOME/.yarnrc.yml" "$HOME/.config/gh" "$HOME/.pypirc" \\
  "$HOME/.docker/config.json" "$HOME/.netrc" "$HOME/.git-credentials" 2>/dev/null
sudo rm -f ${CLOUD_SCRIPT_ENV_FILE} 2>/dev/null
echo "Removed untracked .env files and credential files before the snapshot."
true
`
