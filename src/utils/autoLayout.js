/**
 * Computes an automatic left-to-right hierarchical layout for all canvas nodes.
 * Returns a Map<nodeId, {x, y}> with 16px-snapped positions.
 *
 * Algorithm:
 *  1. Separate stickyNotes and "annotation" textCards from the main graph
 *  2. Find connected components (undirected BFS)
 *  3. Per component: BFS depth → columns, sort by parent Y, stack vertically
 *  4. Iteratively center parents on their children + push overlapping nodes apart
 *  5. Place annotation textCards below their parent systemNode
 *  6. Place stickyNotes in a row at the very bottom
 *
 * "Annotation textCard": a textCard with exactly one incoming edge from a
 * systemNode via sourceHandle 'bottom'. Treated as a label below its parent,
 * not as an independent graph node.
 */

const H_GAP = 48   // horizontal gap between columns
const V_GAP = 32   // vertical gap between nodes in the same column
const C_GAP = 80   // vertical gap between separate connected components
const SNAP  = 16

// Fallbacks espelhados de NODE_DIMS em useCanvasStore.js
const DIMS = {
  client:     { w: 256, h: 112 },
  product:    { w: 192, h: 80  },
  _default:   { w: 224, h: 96  },
  textCard:   { w: 240, h: 64  },
  stickyNote: { w: 240, h: 100 },
}

function nodeW(n) {
  if (n.measured?.width) return n.measured.width
  if (n.type === 'textCard')   return DIMS.textCard.w
  if (n.type === 'stickyNote') return DIMS.stickyNote.w
  return (DIMS[n.data?.category] ?? DIMS._default).w
}

function nodeH(n) {
  if (n.measured?.height) return n.measured.height
  if (n.type === 'textCard')   return DIMS.textCard.h
  if (n.type === 'stickyNote') return DIMS.stickyNote.h
  return (DIMS[n.data?.category] ?? DIMS._default).h
}

function snap(v) {
  return Math.round(v / SNAP) * SNAP
}

export function computeAutoLayout(nodes, edges) {
  const byId   = new Map(nodes.map(n => [n.id, n]))
  const result = new Map()

  // ── 1. Classify nodes ──────────────────────────────────────────────────────

  // Count incoming edges per node
  const inDegree = new Map(nodes.map(n => [n.id, 0]))
  for (const e of edges) {
    if (inDegree.has(e.target)) inDegree.set(e.target, inDegree.get(e.target) + 1)
  }

  // Annotation textCards: single incoming edge via sourceHandle 'bottom' from a systemNode
  const annotationOf  = new Map()   // textCardId  → parentSystemNodeId
  const annotationsOf = new Map()   // parentId    → [textCard nodes]

  for (const e of edges) {
    if (e.sourceHandle !== 'bottom') continue
    const src = byId.get(e.source)
    const tgt = byId.get(e.target)
    if (src?.type !== 'systemNode' || tgt?.type !== 'textCard') continue
    if (inDegree.get(tgt.id) !== 1) continue   // has other parents → treat as regular node
    annotationOf.set(tgt.id, src.id)
    if (!annotationsOf.has(src.id)) annotationsOf.set(src.id, [])
    annotationsOf.get(src.id).push(tgt)
  }

  // Effective height: node + all its annotation textCards stacked below it
  function effectiveH(node) {
    const anns = annotationsOf.get(node.id) ?? []
    return nodeH(node) + anns.reduce((s, a) => s + V_GAP + nodeH(a), 0)
  }

  const skipIds     = new Set([...annotationOf.keys(), ...nodes.filter(n => n.type === 'stickyNote').map(n => n.id)])
  const stickyNotes = nodes.filter(n => n.type === 'stickyNote')
  const mainNodes   = nodes.filter(n => !skipIds.has(n.id))
  const mainIdSet   = new Set(mainNodes.map(n => n.id))

  // ── 2. Directed adjacency (main nodes only) ────────────────────────────────

  const out = new Map(mainNodes.map(n => [n.id, []]))
  const inn = new Map(mainNodes.map(n => [n.id, []]))
  for (const e of edges) {
    if (!mainIdSet.has(e.source) || !mainIdSet.has(e.target)) continue
    out.get(e.source).push(e.target)
    inn.get(e.target).push(e.source)
  }

  // ── 3. Connected components (undirected BFS) ───────────────────────────────

  const visited    = new Set()
  const components = []

  for (const n of mainNodes) {
    if (visited.has(n.id)) continue
    const comp = []
    const q    = [n.id]
    visited.add(n.id)
    while (q.length) {
      const id = q.shift()
      comp.push(id)
      for (const nb of [...(out.get(id) ?? []), ...(inn.get(id) ?? [])]) {
        if (!visited.has(nb) && mainIdSet.has(nb)) { visited.add(nb); q.push(nb) }
      }
    }
    components.push(comp.map(id => byId.get(id)))
  }

  // ── 4. Layout each component ───────────────────────────────────────────────

  let globalY = 100

  for (const comp of components) {
    const compSet = new Set(comp.map(n => n.id))

    // In-degree within component
    const compIndeg = new Map(comp.map(n => [n.id, 0]))
    for (const n of comp) {
      for (const child of out.get(n.id)) {
        if (compSet.has(child)) compIndeg.set(child, compIndeg.get(child) + 1)
      }
    }

    // Roots: nodes with no incoming edges inside the component
    let roots = comp.filter(n => compIndeg.get(n.id) === 0)
    if (!roots.length) roots = [comp[0]]   // full cycle: pick first node as root

    // BFS depth assignment (cycles broken by skipping already-visited nodes)
    const depth   = new Map()
    const bfsQ    = []
    const bfsSeen = new Set()
    for (const r of roots) { depth.set(r.id, 0); bfsQ.push(r.id); bfsSeen.add(r.id) }
    while (bfsQ.length) {
      const id = bfsQ.shift()
      for (const child of out.get(id)) {
        if (!compSet.has(child) || bfsSeen.has(child)) continue
        bfsSeen.add(child)
        depth.set(child, depth.get(id) + 1)
        bfsQ.push(child)
      }
    }
    for (const n of comp) if (!depth.has(n.id)) depth.set(n.id, 0)

    // Group nodes into columns by depth
    const maxD = Math.max(...comp.map(n => depth.get(n.id)))
    const cols  = Array.from({ length: maxD + 1 }, (_, d) => comp.filter(n => depth.get(n.id) === d))

    // Column X positions based on widest node per column
    const colX = []
    let cx = 100
    for (const col of cols) {
      colX.push(cx)
      cx += Math.max(...col.map(n => nodeW(n))) + H_GAP
    }

    // Working position map for this component
    const pos = new Map()

    // Initial vertical stacking (arbitrary order within column)
    for (let c = 0; c < cols.length; c++) {
      let ry = globalY
      for (const node of cols[c]) {
        pos.set(node.id, { x: colX[c], y: ry })
        ry += effectiveH(node) + V_GAP
      }
    }

    // Sort columns 1+ by average parent Y to minimize edge crossings, then restack
    for (let c = 1; c < cols.length; c++) {
      cols[c].sort((a, b) => {
        const avgParentY = (node) => {
          const parents = (inn.get(node.id) ?? []).filter(id => compSet.has(id) && depth.get(id) === c - 1)
          if (!parents.length) return 0
          return parents.reduce((s, id) => s + (pos.get(id)?.y ?? 0), 0) / parents.length
        }
        return avgParentY(a) - avgParentY(b)
      })
      let ry = globalY
      for (const node of cols[c]) {
        pos.set(node.id, { x: colX[c], y: ry })
        ry += effectiveH(node) + V_GAP
      }
    }

    // Iterative refinement: center parents on their children + fix overlaps
    for (let iter = 0; iter < 4; iter++) {
      // Center each parent on the vertical span of its direct children (right-to-left)
      for (let c = cols.length - 2; c >= 0; c--) {
        for (const node of cols[c]) {
          const children = (out.get(node.id) ?? []).filter(id => compSet.has(id) && depth.get(id) === c + 1)
          if (!children.length) continue
          const ys   = children.map(id => pos.get(id)?.y ?? globalY)
          const ends = children.map(id => {
            const n = byId.get(id)
            return (pos.get(id)?.y ?? globalY) + (n ? effectiveH(n) : 0)
          })
          const center = (Math.min(...ys) + Math.max(...ends)) / 2
          pos.set(node.id, { x: colX[c], y: snap(center - nodeH(node) / 2) })
        }
      }

      // Fix overlaps: sort each column top-to-bottom and push apart
      for (let c = 0; c < cols.length; c++) {
        const sorted = [...cols[c]].sort((a, b) => (pos.get(a.id)?.y ?? 0) - (pos.get(b.id)?.y ?? 0))
        let minY = globalY
        for (const node of sorted) {
          const newY = snap(Math.max(pos.get(node.id)?.y ?? 0, minY))
          pos.set(node.id, { x: colX[c], y: newY })
          minY = newY + effectiveH(node) + V_GAP
        }
      }
    }

    // Commit positions to result
    for (const n of comp) result.set(n.id, pos.get(n.id))

    // Place annotation textCards below their parent
    for (const [annId, parentId] of annotationOf) {
      if (!compSet.has(parentId)) continue
      const p          = pos.get(parentId)
      const parentNode = byId.get(parentId)
      if (!p || !parentNode) continue
      result.set(annId, { x: snap(p.x), y: snap(p.y + nodeH(parentNode) + V_GAP) })
    }

    // Advance globalY past this component (effectiveH includes annotation space)
    const bottom = Math.max(...comp.map(n => (pos.get(n.id)?.y ?? globalY) + effectiveH(n)))
    globalY = bottom + C_GAP
  }

  // ── 5. StickyNotes row at the bottom ──────────────────────────────────────

  if (stickyNotes.length) {
    const sy = snap(globalY + 80)
    let sx = 100
    for (const n of stickyNotes) {
      result.set(n.id, { x: sx, y: sy })
      sx += nodeW(n) + H_GAP
    }
  }

  return result
}
