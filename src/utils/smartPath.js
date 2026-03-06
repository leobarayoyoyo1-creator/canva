/**
 * Smart edge routing that avoids systemNode bounding boxes.
 *
 * Detection: checks if the direct straight line from source to target
 * actually intersects a node's bounding box (+ padding). This avoids
 * false positives from corridor-based heuristics.
 *
 * Returns [pathString, labelX, labelY] or null if no routing is needed.
 */

const NODE_PADDING = 24  // clearance around each node

export function computeSmartPath(
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  sourceNodeId, targetNodeId,
  nodes
) {
  // Only apply smart routing for horizontal Right→Left connections.
  // Top/Bottom handle connections are handled correctly by getBezierPath.
  if (sourcePosition !== 'right' || targetPosition !== 'left') return null

  // Only handle clearly forward-going edges
  if (targetX - sourceX < 80) return null

  const obstacles = nodes
    .filter(n =>
      n.type === 'systemNode' &&
      n.id !== sourceNodeId &&
      n.id !== targetNodeId
    )
    .map(n => ({
      left:   n.position.x - NODE_PADDING,
      top:    n.position.y - NODE_PADDING,
      right:  n.position.x + (n.measured?.width  ?? 224) + NODE_PADDING,
      bottom: n.position.y + (n.measured?.height ?? 96)  + NODE_PADDING,
    }))

  if (!obstacles.length) return null

  // Only block if the direct line actually passes through the node's bbox
  const blocking = obstacles.filter(obs =>
    lineIntersectsRect(sourceX, sourceY, targetX, targetY, obs)
  )

  if (!blocking.length) return null

  // Union bounding box of all blocking obstacles
  const union = {
    left:   Math.min(...blocking.map(o => o.left)),
    top:    Math.min(...blocking.map(o => o.top)),
    right:  Math.max(...blocking.map(o => o.right)),
    bottom: Math.max(...blocking.map(o => o.bottom)),
  }

  const midX   = (sourceX + targetX) / 2
  const aboveY = union.top    - NODE_PADDING
  const belowY = union.bottom + NODE_PADDING

  // Pick the side that adds the least vertical detour
  const aboveCost = Math.abs(sourceY - aboveY) + Math.abs(targetY - aboveY)
  const belowCost = Math.abs(sourceY - belowY) + Math.abs(targetY - belowY)
  const routeY    = aboveCost <= belowCost ? aboveY : belowY

  const cpH = Math.min(Math.abs(targetX - sourceX) * 0.25, 160)

  const d = [
    `M ${f(sourceX)},${f(sourceY)}`,
    `C ${f(sourceX + cpH)},${f(sourceY)}`,
    `  ${f(midX - cpH)},${f(routeY)}`,
    `  ${f(midX)},${f(routeY)}`,
    `C ${f(midX + cpH)},${f(routeY)}`,
    `  ${f(targetX - cpH)},${f(targetY)}`,
    `  ${f(targetX)},${f(targetY)}`,
  ].join(' ')

  return [d, midX, routeY]
}

// Returns true if the line segment (x1,y1)→(x2,y2) intersects the rectangle
function lineIntersectsRect(x1, y1, x2, y2, rect) {
  // Quick bounding-box rejection
  if (Math.max(x1, x2) < rect.left   || Math.min(x1, x2) > rect.right)  return false
  if (Math.max(y1, y2) < rect.top    || Math.min(y1, y2) > rect.bottom) return false
  // Either endpoint inside the rect
  if (ptInRect(x1, y1, rect) || ptInRect(x2, y2, rect)) return true
  // Line crosses any of the 4 sides
  return (
    segCross(x1,y1,x2,y2, rect.left,  rect.top,    rect.right, rect.top)    ||
    segCross(x1,y1,x2,y2, rect.right, rect.top,    rect.right, rect.bottom) ||
    segCross(x1,y1,x2,y2, rect.right, rect.bottom, rect.left,  rect.bottom) ||
    segCross(x1,y1,x2,y2, rect.left,  rect.bottom, rect.left,  rect.top)
  )
}

function ptInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function segCross(x1,y1,x2,y2, x3,y3,x4,y4) {
  const denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
  if (Math.abs(denom) < 1e-10) return false  // parallel
  const t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom
  const u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / denom
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

const f = (v) => Math.round(v)
