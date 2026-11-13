import { CLOUD_DESKTOP_OPTIONAL_PACKAGES } from '../../shared/cloud/cloud-desktop-browser'

/** Where a cloud workspace's repository lives inside its sandbox. */
export function sandboxRepoDir(repoName: string): string {
  return `/vercel/${repoName}`
}

/**
 * Orca's layer under every repository build: SSH (key-only, the transport Orca uses), the desktop
 * (VNC bound to localhost, reached only through SSH), Chrome, Docker and rsync. Host keys are
 * deleted so the snapshot carries none; each workspace generates its own on first start.
 */
export const BASE_PROVISION_SCRIPT = `set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \\
  openssh-server websockify tigervnc-standalone-server tigervnc-tools openbox novnc \\
  docker.io docker-compose-v2 dbus-x11 xterm fonts-dejavu-core ca-certificates curl rsync \\
  tint2 x11-xserver-utils \\
  > /tmp/orca-apt.log 2>&1 || { tail -40 /tmp/orca-apt.log; exit 1; }
echo "Packages installed"
# Optional: an emoji font and the tools an agent drives the desktop browser with. A mirror that
# lacks one must not fail the build.
apt-get install -y -qq --no-install-recommends ${CLOUD_DESKTOP_OPTIONAL_PACKAGES.join(' ')} \\
  > /tmp/orca-apt-optional.log 2>&1 || echo "Optional desktop packages were not installed"
curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt-get install -y -qq /tmp/chrome.deb > /tmp/orca-chrome.log 2>&1 || { tail -40 /tmp/orca-chrome.log; exit 1; }
rm -f /tmp/chrome.deb
echo "Chrome installed: $(google-chrome --version)"
mkdir -p /run/sshd
cat > /etc/ssh/sshd_config.d/orca.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers ubuntu
CONF
rm -f /etc/ssh/ssh_host_*
usermod -aG docker ubuntu
apt-get clean
echo "Base ready"
`
