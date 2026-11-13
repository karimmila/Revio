import {
  CLOUD_DESKTOP_CHROME_PROFILE,
  CLOUD_DESKTOP_OPTIONAL_PACKAGES
} from '../../shared/cloud/cloud-desktop-browser'

/** How the desktop's Chrome is started, by the desktop script and by the restart below. */
export const DESKTOP_CHROME_START = `(setsid nohup google-chrome --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} \\
  --no-first-run --no-default-browser-check --disable-dev-shm-usage --start-maximized \\
  http://localhost:3000 >/tmp/orca-chrome.log 2>&1 < /dev/null &)`

export const DESKTOP_OPTIONAL_PACKAGES_JOB_PATH = '/vercel/.config/orca-desktop/optional-packages.sh'

/**
 * Runs detached beside a desktop whose build lacks the optional packages. Chrome reads the font
 * list when it starts, and it starts with the desktop, seconds before the emoji font arrives: it
 * went on drawing emoji as empty boxes until the sandbox next woke. So once the font is in, the
 * Chrome this desktop start opened (`$1` is 1) is started again, but only while every window
 * still shows the page it opened with. A window with anything else is left alone: the person or
 * the agent is using it, and the next start picks the font up.
 */
export const DESKTOP_OPTIONAL_PACKAGES_JOB = `export DEBIAN_FRONTEND=noninteractive DISPLAY=:1
chrome_started_here="\${1:-0}"
profile=${CLOUD_DESKTOP_CHROME_PROFILE}
sudo -n apt-get update -qq && sudo -n apt-get install -y -qq --no-install-recommends ${CLOUD_DESKTOP_OPTIONAL_PACKAGES.join(' ')} || exit 1
command -v fc-cache >/dev/null && fc-cache -f
[ "$chrome_started_here" = 1 ] || exit 0
command -v xdotool >/dev/null || exit 0
desktop_chrome() {
  ps -C chrome -o pid=,args= 2>/dev/null | grep -- "--user-data-dir=$profile" | grep -v -- '--type=' | awk 'NR==1 {print $1}'
}
pid=$(desktop_chrome)
[ -n "$pid" ] || exit 0
pages=$(for window in $(xdotool search --onlyvisible --pid "$pid" 2>/dev/null); do
  xdotool getwindowname "$window" 2>/dev/null
done | grep -- ' - Google Chrome$' | sort -u)
[ -n "$pages" ] || exit 0
in_use=$(printf '%s\\n' "$pages" | grep -Evx '(New Tab|localhost|localhost:3000) - Google Chrome' || true)
if [ -n "$in_use" ]; then
  echo "Chrome is in use; it draws emoji after its next start."
  exit 0
fi
kill "$pid" 2>/dev/null || exit 0
for _ in $(seq 1 20); do
  [ -z "$(desktop_chrome)" ] && break
  sleep 0.25
done
[ -z "$(desktop_chrome)" ] || exit 0
rm -f "$profile"/Singleton*
${DESKTOP_CHROME_START}
echo "Chrome started again with the new fonts."
`
