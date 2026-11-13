import { FORK_CLI_COMMAND_NAME } from '../../../../shared/fork-identity'
export class WorktreeIdRequiresFullPathError extends Error {
  readonly code = 'worktree_id_requires_full_path'

  constructor() {
    super(
      `Worktree id selectors must use the full <repo-id>::<path> value. Use the id from \`${FORK_CLI_COMMAND_NAME} worktree list --json\`, or target by path:<path>, branch:<branch>, or issue:<number>.`
    )
  }
}
