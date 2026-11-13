# Cloud workspaces

Revio can run a workspace in its own [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
instead of as a git worktree on your Mac. Each cloud workspace is one sandbox with its own
checkout, terminals, agent chats, setup script, desktop and ports.

Sandboxes run on your own Vercel account. Vercel bills that account for them. Revio has no
servers of its own and shows no usage figures, so check CPU and storage on Vercel's dashboard.

## Requirements

- A Vercel account. Revio reads your plan from the Vercel API. On Hobby, a sandbox has up to
  4 vCPUs and a session lasts up to 45 minutes. On other plans, a sandbox has up to 8 vCPUs and a
  session lasts up to 24 hours.
- A repository whose origin is on GitHub, with the Revio Workspaces GitHub App installed on it.
- Optional: a Claude setup token (`claude setup-token`), so Claude Code can call the model from
  the cloud.

## Set up

1. **Settings › Cloud › Connect Vercel.** Approve the code in the browser, then choose the team
   that sandboxes run and bill in. Revio creates nothing on Vercel until you choose. It then
   creates one project, `revio-sandboxes`, in that team. If your account is in more than one team,
   **Use a team token** is the safer choice: Revio refuses a token that reaches more than one team.
2. **Settings › Account › GitHub › Sign in with GitHub.** Enter the code that Revio shows on GitHub.
   Then, under **Repositories on this Mac**, use **Install on <owner>** for each owner whose
   repositories you want to use. If you are not an admin of that owner, GitHub sends its admins a
   request, and the repositories show as covered after they approve.
3. Optional: open the help menu at the bottom of the sidebar, choose **Onboarding**, and paste a
   Claude setup token in **Claude in cloud workspaces**.
4. **Settings › Environment**: add the values your scripts need. Each variable has two marks. The
   cloud mark sends it to cloud workspaces, where only the install, setup, wake and Run scripts
   see it. The terminal mark also lets every shell and agent in the sandbox see it. A variable with
   no mark stays on your Mac.
5. **Settings › your repository › Cloud**: write the Install script, the Cloud setup script and the
   Wake script, choose the network mode, and press **Build**. A build installs Revio's base tools,
   clones the default branch, runs the Install script, removes untracked `.env` files and stored
   credentials, and saves a snapshot. Each repository has one snapshot. A new build replaces it.

## Use

- Switch the sidebar to **Cloud** (⌃2) and press **Create**. The workspace starts from the build
  snapshot, with the Install script already done. ⌃1 switches back to your Mac.
- The **Setup** tab runs the Cloud setup script after the branch is checked out.
- The **Desktop** tab in the right panel shows the sandbox screen, with Chrome installed. Click it
  to work in it. Text copies in both directions (up to 1 MB) while the desktop has focus.
- The plug button opens **Ports**. **Public links** lists the sandbox's listening ports.
  **Share publicly**, then **Share**, gives a port a public Vercel address until you press
  **Disable**.
- The cloud button has a **Sync to a local directory** switch: a one-way copy of the sandbox into
  a git worktree on your Mac (files up to 5 MB, 500 MB in total), so the Changes and diff views
  show what the cloud changed.
- **Sleep** (right-click the workspace) stops the sandbox and keeps its files. An idle workspace
  sleeps on its own after 20 minutes. Change this in **Settings › Cloud › Sleep when idle**.
  Opening the workspace resumes the sandbox and runs the Wake script. Running programs do not
  survive a stop.
- **Actions** (**Settings › your repository › Actions**) run from the Run button or with ⌘R.
- **Archive** deletes the sandbox, its keys and the local copy, and keeps the sandbox's last
  snapshot as a restore point. **Unarchive** starts a new sandbox from that snapshot.

## Security model

- **Credentials never enter a sandbox.** Inside a sandbox, `GH_TOKEN` and the Claude token are
  placeholder values. Vercel's network policy for that sandbox adds the real credential to
  requests that match an allowed rule, on the way out.
- **GitHub access is limited to the workspace's own repository.** The policy adds the token for
  git fetch and push to `github.com/<owner>/<repo>.git`, for reads of that repository's API paths
  and `/user`, and for creating and updating pull requests and comments. Every other GitHub
  request gets a 403, including `/graphql`, merges and deletes. Public release downloads pass
  without the token. During a build, GitHub is read-only.
- **GitHub tokens are short-lived.** The GitHub App token lasts 8 hours. Revio refreshes it on
  your Mac and updates the policy of each running sandbox.
- **Tokens are sealed on your Mac.** The Vercel, GitHub and Claude tokens are encrypted with the
  macOS Keychain. If the Keychain is not available, Revio refuses to store them. A value equal to
  one of these tokens never reaches a sandbox, under any name. Variables with credential names
  such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GITHUB_TOKEN` reach only the install, setup,
  wake and Run scripts, even with the terminal mark.
- **SSH is pinned.** Each workspace gets its own key, and Revio pins the sandbox's host key in its
  own data folder. Revio does not write to `~/.ssh`. The public sandbox address carries only
  encrypted SSH. If you set **Settings › Advanced › SSH private key path**, Revio reads that key
  instead of generating one.
- **Your Mac opens every connection.** Nothing in a sandbox can open a connection back to your
  Mac.
- **The desktop binds to localhost** inside the sandbox. Revio reaches it through the SSH tunnel
  only.
- **Network modes.** Allowlist is the default: the sandbox reaches its repository on GitHub,
  Claude, package registries and Ubuntu and Docker mirrors (read-only: GET and HEAD), and the
  extra domains you add for the repository. Open lets the sandbox reach any host. Builds always
  run in Open mode.
- **Public links are off until you share a port.** Anyone with the link can reach that port, so
  share only servers that hold nothing secret.

## Known limits

- Claude Code is the only agent whose credential Revio supplies in a cloud workspace. For other
  agents, Revio adds no credential, and Allowlist mode does not include their model hosts.
- Inside a sandbox, `gh` and the GitHub API reach only the workspace's own repository. GraphQL
  requests are refused, so `gh` commands that use GraphQL fail.
- Vercel ends a session at the plan's limit (45 minutes on Hobby). Revio stops the sandbox before
  the limit and resumes it when you return.
- Idle sleep looks at terminal output and foreground jobs only. A background job does not keep a
  sandbox awake.
- In Allowlist mode, tools that fetch over plain http fail. Vercel's allowlist passes only TLS.
- If Vercel has removed the restore snapshot of an archived workspace, Unarchive starts from the
  repository build and the archived branch. Uncommitted work is then lost.
- Build snapshots of large projects can be several GB.

## Signed local builds

A packaged build made without a certificate gets a new ad-hoc signature every time. macOS then
treats each update as a different app: the Keychain asks again for "Revio Safe Storage", and
privacy grants are lost. Sign local builds with one self-signed certificate to keep one identity:

```sh
export ORCA_FORK_SIGN_IDENTITY=<SHA-1 of your code-signing certificate>
export ORCA_FORK_SIGN_KEYCHAIN="$HOME/Library/Keychains/<your-signing-keychain>.keychain-db"
pnpm run build:mac
```

- `ORCA_FORK_SIGN_IDENTITY` is the certificate's SHA-1, not its name. Unset, the build stays
  ad-hoc signed.
- If signing fails, unlock the keychain: `security unlock-keychain "$ORCA_FORK_SIGN_KEYCHAIN"`.
- Never commit the certificate, its `.p12` or the keychain password.

The certificate is not from Apple and the build is not notarized, so Gatekeeper blocks the first
launch. Open the app, click **Done**, then go to **System Settings › Privacy & Security** and click
**Open Anyway** next to "Revio was blocked". Later updates signed with the same certificate open
normally.
