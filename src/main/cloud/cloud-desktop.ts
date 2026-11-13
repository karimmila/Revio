import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { Sandbox } from '@vercel/sandbox'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { runSandboxScript } from './cloud-sandbox-run'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import {
  CLOUD_DESKTOP_CHROME_PROFILE,
  CLOUD_DESKTOP_OPTIONAL_PACKAGES,
  CLOUD_DESKTOP_PASSWORD_FILE,
  CLOUD_DESKTOP_XVNC_START
} from '../../shared/cloud/cloud-desktop-browser'
import {
  DESKTOP_CHROME_START,
  DESKTOP_OPTIONAL_PACKAGES_JOB,
  DESKTOP_OPTIONAL_PACKAGES_JOB_PATH
} from './cloud-desktop-optional-packages'

/** noVNC's port inside the sandbox; Orca reaches it only through the workspace's SSH tunnel. */
export const SANDBOX_DESKTOP_PORT = 6080

// The desktop: a blue wallpaper, a thin top bar with the clock, a dock with a terminal
// and Chrome, Chrome maximized. tint2 draws both bars; it is in Orca's base layer (builds made
// before it get the plain desktop).
// Backgrounds come first: tint2 numbers them in order, and a panel naming one not yet defined
// crashes it.
const TOP_BAR = `# Background 1: top bar
rounded = 0
border_width = 0
background_color = #f2f2f2 92
border_color = #000000 0

panel_items = FC
panel_position = top center horizontal
panel_size = 100% 22
panel_margin = 0 0
panel_padding = 8 2 8
panel_background_id = 1
panel_layer = top
panel_dock = 0
strut_policy = follow_size
wm_menu = 0

time1_format = %a %b %-d   %-I:%M %p
time1_font = Sans 9
clock_font_color = #222222 100
clock_padding = 4 0
clock_background_id = 0
`

const DOCK = `# Background 1: dock
rounded = 12
border_width = 0
background_color = #1f1f1f 85
border_color = #000000 0

panel_items = L
panel_position = bottom center horizontal
panel_size = 104 52
panel_margin = 0 10
panel_padding = 10 8 10
panel_background_id = 1
panel_layer = top
panel_dock = 0
strut_policy = none
wm_menu = 0

launcher_padding = 0 0 10
launcher_background_id = 0
launcher_icon_size = 32
launcher_item_app = /usr/share/applications/debian-xterm.desktop
launcher_item_app = /usr/share/applications/google-chrome.desktop
`

/** The env var that carries the VNC password into the script; never an argument, never logged. */
export const DESKTOP_PASSWORD_ENV = 'ORCA_VNC_PASSWORD'
const DESKTOP_PASSWORD_FILE = CLOUD_DESKTOP_PASSWORD_FILE

/**
 * The sandbox desktop, started on demand: TigerVNC on display :1, openbox, the bars, Chrome and
 * websockify. Orca draws the screen with its own bundled noVNC client, so the sandbox serves only
 * the VNC websocket, never a page (security audit L4, 2026-11-10). Xvnc is the X server, so it
 * syncs CLIPBOARD and PRIMARY with VNC clients itself; -MaxCutText matches Orca's 1 MB clipboard
 * cap (CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES). Every listener binds 127.0.0.1 inside the sandbox and
 * is reached through the SSH tunnel, which ends in a port on this Mac's loopback. A web page in
 * the person's browser can open a websocket to that port (websockets ignore same-origin), so VNC
 * asks for a password only this app has. The password file is written from the env var with
 * shell builtins, and Xvnc reads it at each connection, so a new password needs no restart. A
 * desktop an older build started without a password is stopped and started again. Ports are
 * checked with ss, not pgrep -f, because this script's own command line holds the same words.
 */
export const DESKTOP_SCRIPT = `set -e
export DISPLAY=:1
vnc_password="\${${DESKTOP_PASSWORD_ENV}:-}"
unset ${DESKTOP_PASSWORD_ENV}
vnc_passwd_tool=$(command -v vncpasswd || command -v tigervncpasswd || true)
if [ -z "$vnc_password" ] || [ -z "$vnc_passwd_tool" ]; then
  echo "The desktop needs TigerVNC's password tool. Rebuild this repository's cloud build." >&2
  exit 1
fi
mkdir -p /vercel/.config/orca-desktop
(umask 077; printf '%s\\n' "$vnc_password" | "$vnc_passwd_tool" -f > ${DESKTOP_PASSWORD_FILE}.new)
if [ ! -s ${DESKTOP_PASSWORD_FILE}.new ]; then
  echo "The desktop password could not be written." >&2
  exit 1
fi
mv -f ${DESKTOP_PASSWORD_FILE}.new ${DESKTOP_PASSWORD_FILE}
vnc_password=
if ps -C Xvnc -o args= | grep -q -- '-SecurityTypes None'; then
  pkill -x Xvnc || true
  for _ in $(seq 1 40); do
    ss -ltn | grep -q '127.0.0.1:5901 ' || pgrep -x chrome >/dev/null || break
    sleep 0.25
  done
fi
if ! ss -ltn | grep -q '127.0.0.1:5901 '; then
  ${CLOUD_DESKTOP_XVNC_START}
fi
# A desktop started by an older ${FORK_PRODUCT_NAME} lacks the flags above; vncconfig sets them on the live server.
command -v vncconfig >/dev/null && vncconfig -display :1 -set MaxCutText=1048576 >/dev/null 2>&1 || true
pgrep -x openbox >/dev/null || (setsid nohup openbox >/tmp/orca-openbox.log 2>&1 < /dev/null &)
command -v xsetroot >/dev/null && xsetroot -solid '#3d8fe6' || true
if command -v tint2 >/dev/null && ! pgrep -x tint2 >/dev/null; then
  mkdir -p /vercel/.config/orca-desktop
  cat > /vercel/.config/orca-desktop/top.tint2rc <<'RC'
${TOP_BAR}RC
  cat > /vercel/.config/orca-desktop/dock.tint2rc <<'RC'
${DOCK}RC
  (setsid nohup tint2 -c /vercel/.config/orca-desktop/top.tint2rc >/tmp/orca-tint2-top.log 2>&1 < /dev/null &)
  (setsid nohup tint2 -c /vercel/.config/orca-desktop/dock.tint2rc >/tmp/orca-tint2-dock.log 2>&1 < /dev/null &)
fi
# Only the Chrome on the desktop's own profile counts: an agent's headless test browser is a
# chrome process too, and with one running the desktop came up with no browser at all.
desktop_chrome_runs() {
  ps -C chrome -o args= 2>/dev/null | grep -q -- '--user-data-dir=${CLOUD_DESKTOP_CHROME_PROFILE}'
}
chrome_started_here=1
desktop_chrome_runs && chrome_started_here=0
# Builds made before these packages were in the base layer lack them. Installed in the background,
# so a slow or refused install never delays or fails the desktop.
if ! dpkg -s ${CLOUD_DESKTOP_OPTIONAL_PACKAGES.join(' ')} >/dev/null 2>&1; then
  cat > ${DESKTOP_OPTIONAL_PACKAGES_JOB_PATH} <<'JOB'
${DESKTOP_OPTIONAL_PACKAGES_JOB}JOB
  (setsid nohup bash ${DESKTOP_OPTIONAL_PACKAGES_JOB_PATH} "$chrome_started_here" \\
    >/tmp/orca-desktop-optional.log 2>&1 < /dev/null &)
fi
# The profile outlives the session but its lock names the old session's host name, so after a
# wake Chrome refused it ("profile appears to be in use … on another computer").
desktop_chrome_runs || rm -f ${CLOUD_DESKTOP_CHROME_PROFILE}/Singleton*
desktop_chrome_runs || ${DESKTOP_CHROME_START}
# Older desktops served noVNC's web client from the sandbox; serve only the websocket now. Only
# that websockify stops: another one is the SSH bridge ${FORK_PRODUCT_NAME} reaches the sandbox through.
old_web=$(ps -C websockify -o pid=,args= | awk '/--web/ && /:${SANDBOX_DESKTOP_PORT} / {print $1}')
if [ -n "$old_web" ]; then
  kill $old_web || true
  sleep 0.5
fi
rm -rf /vercel/.orca-desktop-web
if ! ss -ltn | grep -q '127.0.0.1:${SANDBOX_DESKTOP_PORT} '; then
  (setsid nohup websockify 127.0.0.1:${SANDBOX_DESKTOP_PORT} localhost:5901 \\
    >/tmp/orca-novnc.log 2>&1 < /dev/null &)
  for _ in $(seq 1 40); do ss -ltn | grep -q '127.0.0.1:${SANDBOX_DESKTOP_PORT} ' && break; sleep 0.25; done
fi
ss -ltn | grep -q '127.0.0.1:${SANDBOX_DESKTOP_PORT} '
`

function freeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

// One password per sandbox for as long as the app runs: the preview and the full view start the
// desktop separately and must both keep connecting. It is never written to this Mac's disk.
const desktopPasswords = new Map<string, string>()

/** VNC authentication reads eight characters; these are 48 random bits. */
export function desktopPasswordFor(sandboxName: string): string {
  let password = desktopPasswords.get(sandboxName)
  if (!password) {
    password = randomBytes(6).toString('base64url')
    desktopPasswords.set(sandboxName, password)
  }
  return password
}

export async function startCloudDesktop(
  userDataPath: string,
  environmentId: string
): Promise<{
  sshTargetId: string
  remotePort: number
  suggestedLocalPort: number
  password: string
}> {
  const runtime = listEphemeralVmRuntimes(userDataPath).find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      entry.runtimeEnvironmentId === environmentId &&
      entry.status === 'running'
  )
  const userData = runtime?.recipeResult?.userData
  const name = userData && typeof userData === 'object' ? userData.sandboxName : undefined
  if (!runtime?.sshTargetId || typeof name !== 'string') {
    throw new Error('This workspace has no running cloud sandbox. Open it first.')
  }
  const sandbox = await Sandbox.get({ ...(await vercelScope()), name })
  const password = desktopPasswordFor(name)
  await runSandboxScript(sandbox, DESKTOP_SCRIPT, { env: { [DESKTOP_PASSWORD_ENV]: password } })
  return {
    sshTargetId: runtime.sshTargetId,
    remotePort: SANDBOX_DESKTOP_PORT,
    suggestedLocalPort: await freeLocalPort(),
    password
  }
}
