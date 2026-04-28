import { PATH_SEP, ROOT_ID } from './utils'

export interface HistoryTask {
  error?: string
  interrupts?: unknown[]
}

export interface HistoryState {
  parent_checkpoint?: { checkpoint_id: string }
  checkpoint: { checkpoint_id: string; thread_id?: string }
  values: Record<string, unknown>
  tasks?: HistoryTask[]
  next?: string[]
}

export type SequenceNodeItem = SequenceFork | SequenceLeaf

export interface SequenceSequence {
  type: 'sequence'
  items: SequenceNodeItem[]
}

export interface SequenceFork {
  type: 'fork'
  items: SequenceSequence[]
}

export interface SequenceLeaf {
  type: 'node'
  value: HistoryState
  path: string[]
}

export type SequenceNode = SequenceSequence | SequenceFork | SequenceLeaf

/**
 * Convert a flat history array into a tree-like structure representing branches
 */
export function getBranchSequence(history: HistoryState[]): {
  rootSequence: SequenceSequence
  paths: string[][]
} {
  const childrenMap: Record<string, HistoryState[]> = {}
  // Build a set of all checkpoint IDs present in the history
  const knownIds = new Set(history.map((s) => s.checkpoint.checkpoint_id))
  // First pass - collect nodes for each checkpoint.
  // If a state's parent isn't in the fetched set, treat it as a root ('$').
  // This handles paginated history (limit < total checkpoints).
  history.forEach((state) => {
    const parentId = state.parent_checkpoint?.checkpoint_id
    const effectiveParent = parentId && knownIds.has(parentId) ? parentId : '$'
    childrenMap[effectiveParent] ??= []
    childrenMap[effectiveParent].push(state)
  })
  const rootSequence: SequenceSequence = { type: 'sequence', items: [] }
  const queue: { id: string; sequence: SequenceSequence; path: string[] }[] = [
    { id: '$', sequence: rootSequence, path: [] },
  ]
  const paths: string[][] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const task = queue.shift()
    if (!task || visited.has(task.id)) continue
    visited.add(task.id)
    const children = childrenMap[task.id]
    if (children == null || children.length === 0) continue
    // If we've encountered a fork (2+ children), push the fork
    // to the sequence and add a new sequence for each child
    let fork: SequenceFork | undefined
    if (children.length > 1) {
      fork = { type: 'fork', items: [] }
      task.sequence.items.push(fork)
    }
    for (const value of children) {
      const id = value.checkpoint.checkpoint_id
      let { sequence, path } = task
      if (fork != null) {
        sequence = { type: 'sequence', items: [] }
        fork.items.unshift(sequence)
        path = path.slice()
        path.push(id)
        paths.push(path)
      }
      sequence.items.push({ type: 'node', value, path })
      queue.push({ id, sequence, path })
    }
  }
  return { rootSequence, paths }
}

/**
 * Convert a sequence tree into a flat view based on the selected branch
 */
export function getBranchView(
  sequence: SequenceSequence,
  paths: string[][],
  branch: string
): {
  history: HistoryState[]
  branchByCheckpoint: Record<string, { branch: string; branchOptions: string[] }>
} {
  const path = branch.split(PATH_SEP)
  const pathMap: Record<string, string[][]> = {}
  for (const path of paths) {
    const parent = path.at(-2) ?? ROOT_ID
    pathMap[parent] ??= []
    pathMap[parent].unshift(path)
  }
  const history: HistoryState[] = []
  const branchByCheckpoint: Record<string, { branch: string; branchOptions: string[] }> = {}
  const forkStack = path.slice()
  const queue: SequenceNodeItem[] = [...sequence.items]
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) continue
    if (item.type === 'node') {
      history.push(item.value)
      branchByCheckpoint[item.value.checkpoint.checkpoint_id] = {
        branch: item.path.join(PATH_SEP),
        branchOptions: (item.path.length > 0
          ? (pathMap[item.path.at(-2) ?? ROOT_ID] ?? [])
          : []
        ).map((p: string[]) => p.join(PATH_SEP)),
      }
    }
    if (item.type === 'fork') {
      const forkId = forkStack.shift()
      const index =
        forkId != null
          ? item.items.findIndex((value) => {
              const firstItem = value.items.at(0)
              if (!firstItem || firstItem.type !== 'node') return false
              return firstItem.value.checkpoint.checkpoint_id === forkId
            })
          : -1
      const nextItems = item.items.at(index)?.items ?? []
      queue.push(...nextItems)
    }
  }
  return { history, branchByCheckpoint }
}
