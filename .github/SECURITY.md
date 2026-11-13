# Security policy

## Report a vulnerability

Please do not open a public issue for a security problem.

Report it privately on GitHub: open the repository's **Security** tab and choose
[**Report a vulnerability**](https://github.com/karimmila/Revio/security/advisories/new). Only the
maintainers can read the report.

Include:

- The Revio version (**Revio › About Revio**) or the commit you built from
- Your macOS version
- The steps to reproduce
- The impact you expect

Remove tokens, keys and other private values from logs and screenshots before you attach them.

We aim to acknowledge a report within 3 business days, and we keep you informed until the problem
is fixed.

## Scope

We are most interested in:

- A way for code in a cloud sandbox to read real credentials, to reach your Mac, or to act on
  repositories other than its own.
- A way for a repository, branch name, pull request or agent output to run commands on your Mac
  outside the workspace.
- Secrets written to logs, crash reports or the UI.

Out of scope:

- What a coding agent does inside the workspace you gave it. An agent runs commands with your
  permissions in a local workspace. Use a cloud workspace for code you do not trust.
- Problems in a coding agent CLI, in Vercel Sandbox or in GitHub. Report those to their vendors.

## Supported versions

Security fixes go into the latest release. Revio does not update itself yet, so check the
[releases page](https://github.com/karimmila/Revio/releases) for new versions.

The [README](../README.md#how-revio-keeps-your-code-and-keys-safe) describes how Revio handles
credentials.
