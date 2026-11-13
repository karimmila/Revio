# Contributing to Revio

Thanks for your interest in Revio. Bug reports, ideas and pull requests are welcome.

## Report a bug or ask for a feature

- Search the [open issues](https://github.com/karimmila/Revio/issues) first.
- For a bug, use the bug report template. Give your Revio version, your macOS version, the steps
  to reproduce, what you expected and what happened.
- For a larger change or a new feature, open an issue before you write code, so we can agree on
  the approach.
- For a security problem, do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Set up

You need:

- A Mac with Apple silicon and macOS 13.4 or later
- [Node.js](https://nodejs.org) 24
- [pnpm](https://pnpm.io) 12 (`package.json` pins the exact version)
- Git, and the Xcode Command Line Tools (`xcode-select --install`) to compile the native modules
- At least one coding agent CLI, for example [Claude Code](https://docs.anthropic.com/en/docs/claude-code),
  to try your change in the app

```bash
git clone https://github.com/karimmila/Revio.git
cd Revio
pnpm install
pnpm dev
```

`pnpm dev` starts a development copy of the app with hot reload. It keeps its data apart from an
installed Revio, so you can run both.

## Check your change

```bash
pnpm typecheck                           # type-check all projects
pnpm test path/to/changed-file.test.ts   # run the tests for the code you changed
pnpm exec oxlint path/to/changed-file.ts # lint the files you changed
pnpm exec oxfmt --write path/to/changed-file.ts
```

`pnpm test` without a path runs the full unit test suite, and `pnpm lint` runs every repository
check. Both take several minutes. Some of these checks do not pass on `main` yet, so compare with
`main` before you assume a failure is yours.

A pre-commit hook formats and lints the files you stage.

## Pull requests

- Keep a pull request small and about one change.
- Add or update a test when you change behavior that a test can catch.
- Put user-facing text through the translation helper (`translate()`), not as literal strings.
- Take the product name from `src/shared/fork-identity.json`, not from a hard-coded string.
- Describe what changed and why. Add a screenshot or a short video for a UI change.
- Read [`docs/STYLEGUIDE.md`](../docs/STYLEGUIDE.md) before you change the UI.

## Where things are

| Path           | Contents                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `src/main`     | Electron main process: workspaces, git, cloud sandboxes, GitHub, storage |
| `src/renderer` | The React UI                                                             |
| `src/preload`  | The bridge between the UI and the main process                           |
| `src/shared`   | Types and logic used by both sides                                       |
| `src/cli`      | The `revio` command-line tool                                            |
| `tests`        | End-to-end tests                                                         |

## Code of conduct

This project follows the [Contributor Covenant](../CODE_OF_CONDUCT.md). By taking part, you agree
to follow it.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](../LICENSE).
