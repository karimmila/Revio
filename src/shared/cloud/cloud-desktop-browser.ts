import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../fork-identity'

/** The profile of the Chrome that runs on a cloud sandbox's desktop; it outlives the session. */
export const CLOUD_DESKTOP_CHROME_PROFILE = '/vercel/.orca-desktop-chrome'

/**
 * Packages the desktop is better with but works without: an emoji font (Chrome drew emoji as
 * empty boxes) and the tools an agent needs to drive the browser without killing it.
 */
export const CLOUD_DESKTOP_OPTIONAL_PACKAGES = ['fonts-noto-color-emoji', 'xdotool', 'wmctrl']

/** Xvnc reads this at each connection, so the app can replace the password without a restart. */
export const CLOUD_DESKTOP_PASSWORD_FILE = '/vercel/.config/orca-desktop/vncpasswd'

/**
 * Starts the desktop's X server and waits for it. Only ever with a password: every listener is
 * on the sandbox's loopback, but a page in the person's browser can reach the tunnel's port.
 */
export const CLOUD_DESKTOP_XVNC_START = `(setsid nohup Xvnc :1 -localhost -SecurityTypes VncAuth -PasswordFile ${CLOUD_DESKTOP_PASSWORD_FILE} \\
    -geometry 1600x1000 -depth 24 -AlwaysShared \\
    -AcceptCutText=1 -SendCutText=1 -SendPrimary=1 -SetPrimary=1 -MaxCutText=1048576 \\
    >/tmp/orca-xvnc.log 2>&1 < /dev/null &)
  for _ in $(seq 1 40); do ss -ltn | grep -q '127.0.0.1:5901 ' && break; sleep 0.25; done`

/** Where the sandbox's helper commands live; the pull-request command sits beside this one. */
export const CLOUD_OPEN_URL_COMMAND_NAME = `${FORK_CLI_COMMAND_NAME}-open-url`
export const CLOUD_OPEN_URL_COMMAND_PATH = `/vercel/.${FORK_CLI_COMMAND_NAME}/bin/${CLOUD_OPEN_URL_COMMAND_NAME}`

/**
 * Shows a page in the one Chrome on the sandbox's desktop and brings it to the front. Agents that
 * started Chrome their own way (another profile, or no profile) got a second window: the user
 * then saw a "New Tab" window on the desktop while the agent said the page was open.
 *
 * The desktop's Chrome is the `chrome` process whose arguments name the desktop profile and no
 * `--type=`. With one running, starting Chrome again on that profile only hands it the URL, which
 * opens as a tab in its window. Otherwise it is started here, as the desktop itself starts it.
 */
export const CLOUD_OPEN_URL_COMMAND_SCRIPT = `#!/usr/bin/env bash
set -u
name=$(basename "$0")
url="\${1:-}"
if [ -z "$url" ] || [ "$#" -ne 1 ]; then
  echo "usage: $name <url>" >&2
  exit 2
fi
export DISPLAY=:1
profile=${CLOUD_DESKTOP_CHROME_PROFILE}
# The desktop starts when the user first opens the workspace's Desktop tab. Before that, the
# screen is started here, so the page is there when they open the tab: the tab finds the screen
# running, sets its own password and adds the bars. A password nobody knows keeps it closed
# until then.
started_desktop=
if ! ss -ltn 2>/dev/null | grep -q '127.0.0.1:5901 '; then
  password_tool=$(command -v vncpasswd || command -v tigervncpasswd || true)
  if [ -z "$password_tool" ] || ! command -v Xvnc >/dev/null 2>&1; then
    echo "$name: this sandbox has no desktop. Tell the user to rebuild this repository's cloud build." >&2
    exit 1
  fi
  mkdir -p "$(dirname ${CLOUD_DESKTOP_PASSWORD_FILE})"
  if [ ! -s ${CLOUD_DESKTOP_PASSWORD_FILE} ]; then
    (umask 077; head -c 24 /dev/urandom | base64 | head -c 8 | "$password_tool" -f > ${CLOUD_DESKTOP_PASSWORD_FILE})
  fi
  if [ -s ${CLOUD_DESKTOP_PASSWORD_FILE} ]; then
    ${CLOUD_DESKTOP_XVNC_START}
    pgrep -x openbox >/dev/null || (setsid nohup openbox >/tmp/orca-openbox.log 2>&1 < /dev/null &)
  fi
  if ! ss -ltn 2>/dev/null | grep -q '127.0.0.1:5901 '; then
    echo "$name: the desktop did not start, so the page is not open. Report this error; do not start a browser another way." >&2
    exit 1
  fi
  started_desktop=1
fi
desktop_chrome() {
  ps -C chrome -o pid=,args= 2>/dev/null | grep -- "--user-data-dir=$profile" | grep -v -- '--type=' | awk 'NR==1 {print $1}'
}
if [ -n "$(desktop_chrome)" ]; then
  google-chrome --user-data-dir="$profile" --no-first-run --no-default-browser-check "$url" \\
    >/dev/null 2>&1 < /dev/null &
else
  rm -f "$profile"/Singleton*
  (setsid nohup google-chrome --user-data-dir="$profile" --no-first-run --no-default-browser-check \\
    --disable-dev-shm-usage --start-maximized "$url" >/tmp/orca-chrome.log 2>&1 < /dev/null &)
fi
# In front of any other window: the page must be what the user sees.
raised=
if command -v xdotool >/dev/null 2>&1; then
  for _ in $(seq 1 24); do
    pid=$(desktop_chrome)
    window=
    [ -n "$pid" ] && window=$(xdotool search --onlyvisible --pid "$pid" 2>/dev/null | tail -1)
    if [ -n "$window" ]; then
      xdotool windowactivate "$window" >/dev/null 2>&1 && raised=1
      break
    fi
    sleep 0.25
  done
fi
if [ -z "$raised" ] && command -v wmctrl >/dev/null 2>&1; then
  wmctrl -x -a google-chrome >/dev/null 2>&1 && raised=1
fi
if [ -n "$started_desktop" ]; then
  echo "Opened $url in the desktop browser. The user sees it when they open this workspace's Desktop tab in ${FORK_PRODUCT_NAME}; nothing else is needed."
elif [ -n "$raised" ]; then
  echo "Opened $url in the desktop browser, in front."
else
  echo "Opened $url in the desktop browser. It could not be brought to the front (xdotool and wmctrl are missing or found no window)."
fi
`

/**
 * What a cloud workspace's agent is told about the desktop. Without it an agent that wanted to
 * show or reload a page started a second Chrome, or killed the one on the desktop.
 */
export const CLOUD_DESKTOP_BROWSER_INSTRUCTION = [
  `This sandbox has a desktop (display :1) with one Chrome, which the user watches from ${FORK_PRODUCT_NAME} once they have opened it.`,
  `To show a page there, run \`${CLOUD_OPEN_URL_COMMAND_PATH} <url>\`: it opens the page as a tab in that Chrome and brings it to the front.`,
  `Do not start Chrome on the desktop any other way (no \`google-chrome <url>\`, no other \`--user-data-dir\`, no \`--remote-debugging-port\` window): a second window hides the page from the user. A headless browser for tests is fine.`,
  'To reload the page in front, run `DISPLAY=:1 xdotool key F5`. Never kill Chrome to reload a page.',
  `The command also works before the user has opened the desktop: it starts the screen, and the page is there when they open the workspace's Desktop tab. Do not ask the user to open the desktop first, and do not wait for them. Only when the command does not exist, run \`DISPLAY=:1 google-chrome --no-first-run --user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE} <url> >/dev/null 2>&1 &\`.`
].join(' ')
