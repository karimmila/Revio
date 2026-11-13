import React from 'react'
import WorktreeContextMenuView from './WorktreeContextMenuView'
import {
  useWorktreeContextMenuModel,
  type WorktreeContextMenuProps
} from './use-worktree-context-menu-model'
import { useRevioLayout } from '@/components/revio-layout/revio-layout'
import { RevioWorktreeContextMenuView } from '@/components/revio-layout/RevioWorktreeContextMenuView'

const WorktreeContextMenu = React.memo(function WorktreeContextMenu(
  props: WorktreeContextMenuProps
) {
  const model = useWorktreeContextMenuModel(props)
  const revioLayout = useRevioLayout()
  // Batch actions on a multi-selection keep Orca's full menu.
  if (revioLayout && !model.isMultiContext) {
    return <RevioWorktreeContextMenuView model={model} />
  }
  return <WorktreeContextMenuView model={model} />
})

export default WorktreeContextMenu
