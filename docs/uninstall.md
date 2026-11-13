# Uninstall Revio

This page tells you how to remove Revio from a Mac and where Revio keeps its data.

Your code is not part of Revio. Revio does not delete your repositories or your workspace folders, and you must not delete them unless you are sure that all work is pushed.

## 1. Quit Revio completely

Open the **Revio** menu and select **Quit Completely…**. This stops every terminal session and running agent, and the background process that keeps them.

A plain **Quit** keeps sessions running in the background so that Revio can attach to them again. Do not use it before you uninstall.

## 2. Remove the app

Drag **Revio** from your **Applications** folder to the Trash.

## 3. Remove the data

Revio keeps its data in these places. Delete only what you no longer need.

| What                                                                           | Where                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Settings, the project and workspace lists, chat history, sealed sign-ins, logs | `~/Library/Application Support/revio`                        |
| Logs only                                                                      | `~/Library/Application Support/revio/logs`                   |
| Preferences                                                                    | `~/Library/Preferences/dev.revio.app.plist`                  |
| Caches, if the folder exists                                                   | `~/Library/Caches/dev.revio.app`                             |
| Saved window state, if the folder exists                                       | `~/Library/Saved Application State/dev.revio.app.savedState` |

To remove all of them, run this in Terminal:

```sh
rm -rf ~/Library/Application\ Support/revio \
  ~/Library/Preferences/dev.revio.app.plist \
  ~/Library/Caches/dev.revio.app \
  ~/Library/Saved\ Application\ State/dev.revio.app.savedState
```

### The keychain item

Revio seals its sign-ins (GitHub, Vercel, Claude tokens) with a key that macOS keeps in your login keychain. The item has the name **Revio Safe Storage**.

1. Open **Keychain Access**.
2. Search for `Revio Safe Storage`.
3. Delete the item.

Without the data folder, this key opens nothing. You can delete it safely.

### The command-line link

If you installed the `revio` command from **Settings**, remove the link:

```sh
sudo rm -f /usr/local/bin/revio
rm -f ~/.local/bin/revio
```

Revio uses `~/.local/bin/revio` only on a Mac that has no `/usr/local/bin` folder.

### Saved keys and key bindings

Revio keeps custom key bindings and some saved credentials in `~/.revio`. Delete this folder to remove them.

Revio is based on Orca, and Orca keeps its own files in `~/orca` and `~/.orca`. If you use Orca, do not delete those folders when you remove Revio. If you used a Revio build from before version 0.1.0, your workspaces can still be in `~/orca/workspaces`: look at the workspace folder that **Settings** shows.

## 4. Your workspaces

Each local workspace is a Git worktree in the workspace folder that **Settings** shows. The default is `~/revio/workspaces`, and repositories that you cloned from Revio are in `~/revio/projects`. These folders contain your code.

Before you delete a workspace folder, make sure that its branch is pushed. To remove a worktree correctly, run `git worktree remove <folder>` in the repository, or archive the workspace in Revio before you uninstall.

## 5. Accounts and cloud resources

Removing the app does not change your accounts. Do these steps if you want to disconnect them.

- **GitHub.** Open [github.com/settings/apps/authorizations](https://github.com/settings/apps/authorizations) and revoke the Revio GitHub App. To remove its access to repositories, open [github.com/settings/installations](https://github.com/settings/installations) and uninstall it.
- **Vercel.** Cloud workspaces run as sandboxes in a Vercel project with the name `revio-sandboxes` in your team. Archive or delete your cloud workspaces in Revio first. Then delete that project in the Vercel dashboard, and delete the access token if you made one for Revio.
- **Claude.** A setup token that you made with `claude setup-token` for cloud workspaces is stored only in the data folder. When you delete the folder, Revio's copy is gone.

## Reinstall

If you install Revio again and kept `~/Library/Application Support/revio` and the keychain item, Revio opens with your settings, projects and sign-ins.
