/**
 * Layout de pins do mapa do roteiro.
 *
 * - Paradas que colidem → um stack (um pin + popup com lista); sem fan circular.
 * - Refeições / home que colidem com âncora → offset lateral fixo em coluna
 *   (lado direito), sem formar círculo no zoom afastado.
 * - Rota e meal legs usam sempre as coordenadas verdadeiras.
 *
 * Projeção em pixels é injetável (Leaflet) para testes sem mapa real.
 */

export const COLLISION_PX = 28
/** Deslocamento horizontal (px) para meals/home ao lado da âncora. */
export const SIDE_OFFSET_PX = 44
/** Espaçamento vertical (px) entre vários pins laterais. */
export const SIDE_STEP_PX = 32

const KIND_SORT = { stop: 0, meal: 1, home: 2 }

/**
 * @typedef {'stop' | 'meal' | 'home'} PinKind
 * @typedef {[number, number]} LatLngTuple
 *
 * @typedef {{
 *   id: string,
 *   kind: PinKind,
 *   latLng: LatLngTuple,
 *   order?: number | null,
 * }} LayoutPin
 *
 * @typedef {{
 *   displayLatLng: LatLngTuple,
 *   trueLatLng: LatLngTuple,
 *   groupId: number,
 *   isOffset: boolean,
 *   sideIndex: number,
 *   stackId: string | null,
 * }} PinLayoutEntry
 *
 * @typedef {{
 *   stackId: string,
 *   groupId: number,
 *   memberIds: string[],
 *   displayLatLng: LatLngTuple,
 *   trueLatLng: LatLngTuple,
 * }} StopStack
 *
 * @typedef {{
 *   entries: Map<string, PinLayoutEntry>,
 *   stacks: StopStack[],
 * }} PinLayoutResult
 *
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * @param {Point} a
 * @param {Point} b
 */
function distPx(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/**
 * Union-find por proximidade em pixels.
 * @param {Point[]} points
 * @param {number} collisionPx
 * @returns {number[]} groupId por índice
 */
export function groupByProximity(points, collisionPx = COLLISION_PX) {
  const n = points.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }

  function unite(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (distPx(points[i], points[j]) < collisionPx) unite(i, j)
    }
  }

  const rootToGroup = new Map()
  let next = 0
  const groups = new Array(n)
  for (let i = 0; i < n; i += 1) {
    const r = find(i)
    if (!rootToGroup.has(r)) rootToGroup.set(r, next++)
    groups[i] = rootToGroup.get(r)
  }
  return groups
}

/**
 * @param {LayoutPin[]} pins
 * @param {number[]} indices
 */
function sortGroupIndices(pins, indices) {
  return [...indices].sort((ia, ib) => {
    const a = pins[ia]
    const b = pins[ib]
    const ka = KIND_SORT[a.kind] ?? 9
    const kb = KIND_SORT[b.kind] ?? 9
    if (ka !== kb) return ka - kb
    const oa = Number(a.order)
    const ob = Number(b.order)
    const aHas = Number.isFinite(oa)
    const bHas = Number.isFinite(ob)
    if (aHas && bHas && oa !== ob) return oa - ob
    if (aHas !== bHas) return aHas ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * Centróide em pixels.
 * @param {Point[]} points
 * @param {number[]} indices
 */
function centroidPx(points, indices) {
  let sx = 0
  let sy = 0
  for (const i of indices) {
    sx += points[i].x
    sy += points[i].y
  }
  const n = indices.length || 1
  return { x: sx / n, y: sy / n }
}

/**
 * Calcula layout: stacks de paradas + offset lateral para meals/home.
 *
 * @param {LayoutPin[]} pins
 * @param {{
 *   project: (latLng: LatLngTuple) => Point,
 *   unproject: (point: Point) => LatLngTuple,
 *   collisionPx?: number,
 *   sideOffsetPx?: number,
 *   sideStepPx?: number,
 * }} opts
 * @returns {PinLayoutResult}
 */
export function computePinLayout(pins, opts) {
  const {
    project,
    unproject,
    collisionPx = COLLISION_PX,
    sideOffsetPx = SIDE_OFFSET_PX,
    sideStepPx = SIDE_STEP_PX,
  } = opts

  /** @type {Map<string, PinLayoutEntry>} */
  const entries = new Map()
  /** @type {StopStack[]} */
  const stacks = []

  if (!Array.isArray(pins) || pins.length === 0) {
    return { entries, stacks }
  }

  const points = pins.map((p) => project(p.latLng))
  const groupIds = groupByProximity(points, collisionPx)

  /** @type {Map<number, number[]>} */
  const byGroup = new Map()
  for (let i = 0; i < pins.length; i += 1) {
    const g = groupIds[i]
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(i)
  }

  for (const [groupId, indices] of byGroup) {
    if (indices.length === 1) {
      const i = indices[0]
      const pin = pins[i]
      entries.set(pin.id, {
        displayLatLng: pin.latLng,
        trueLatLng: pin.latLng,
        groupId,
        isOffset: false,
        sideIndex: 0,
        stackId: null,
      })
      continue
    }

    const ordered = sortGroupIndices(pins, indices)
    const stopIndices = ordered.filter((i) => pins[i].kind === 'stop')
    const sideIndices = ordered.filter((i) => pins[i].kind !== 'stop')

    /** @type {Point} */
    let anchorPx
    /** @type {LatLngTuple} */
    let anchorLatLng
    /** @type {string | null} */
    let stackId = null

    if (stopIndices.length >= 2) {
      anchorPx = centroidPx(points, stopIndices)
      anchorLatLng = unproject(anchorPx)
      // Id estável por membros (não por groupId efêmero) — evita sheet/popup
      // perder o alvo quando o layout recalcula no zoom/pan.
      const memberIds = stopIndices.map((i) => pins[i].id)
      stackId = `stack:${[...memberIds].sort().join('+')}`
      stacks.push({
        stackId,
        groupId,
        memberIds,
        displayLatLng: anchorLatLng,
        trueLatLng: anchorLatLng,
      })
      for (const i of stopIndices) {
        const pin = pins[i]
        entries.set(pin.id, {
          displayLatLng: anchorLatLng,
          trueLatLng: pin.latLng,
          groupId,
          isOffset: false,
          sideIndex: 0,
          stackId,
        })
      }
    } else if (stopIndices.length === 1) {
      const i = stopIndices[0]
      const pin = pins[i]
      anchorPx = points[i]
      anchorLatLng = pin.latLng
      entries.set(pin.id, {
        displayLatLng: pin.latLng,
        trueLatLng: pin.latLng,
        groupId,
        isOffset: false,
        sideIndex: 0,
        stackId: null,
      })
    } else {
      // Só meals/home no grupo — âncora no centróide; offset relativo ao centróide.
      anchorPx = centroidPx(points, indices)
      anchorLatLng = unproject(anchorPx)
    }

    // Coluna lateral à direita da âncora (leste em layer coords ≈ +x).
    for (let si = 0; si < sideIndices.length; si += 1) {
      const i = sideIndices[si]
      const pin = pins[i]
      const dx = sideOffsetPx
      const dy = (si - (sideIndices.length - 1) / 2) * sideStepPx
      const displayLatLng = unproject({ x: anchorPx.x + dx, y: anchorPx.y + dy })
      entries.set(pin.id, {
        displayLatLng,
        trueLatLng: pin.latLng,
        groupId,
        isOffset: true,
        sideIndex: si,
        stackId: null,
      })
    }
  }

  return { entries, stacks }
}

/**
 * Layout seguro durante pan/fly/zoom animado.
 * Preserva stacks e congela offsets laterais quando as coords verdadeiras
 * não mudaram (evita teleport). Se o true lat/lng mudou (troca de restaurante),
 * colapsa só esse pin para a nova coordenada.
 *
 * @param {LayoutPin[]} pins
 * @param {PinLayoutResult | null | undefined} previousLayout
 * @returns {PinLayoutResult}
 */
export function buildAnimSafePinLayout(pins, previousLayout) {
  const prevEntries =
    previousLayout?.entries instanceof Map ? previousLayout.entries : null
  const prevStacks = Array.isArray(previousLayout?.stacks)
    ? previousLayout.stacks
    : []

  if (!prevEntries || prevEntries.size === 0) {
    /** @type {Map<string, PinLayoutEntry>} */
    const entries = new Map()
    for (const pin of pins || []) {
      if (!pin?.id || !Array.isArray(pin.latLng) || pin.latLng.length < 2) continue
      entries.set(pin.id, {
        displayLatLng: pin.latLng,
        trueLatLng: pin.latLng,
        groupId: 0,
        isOffset: false,
        sideIndex: 0,
        stackId: null,
      })
    }
    return { entries, stacks: [] }
  }

  /** @type {Map<string, PinLayoutEntry>} */
  const entries = new Map()
  for (const pin of pins || []) {
    if (!pin?.id || !Array.isArray(pin.latLng) || pin.latLng.length < 2) continue
    const prev = prevEntries.get(pin.id)
    if (prev?.stackId) {
      entries.set(pin.id, {
        displayLatLng: prev.displayLatLng || pin.latLng,
        trueLatLng: pin.latLng,
        groupId: prev.groupId ?? 0,
        isOffset: false,
        sideIndex: 0,
        stackId: prev.stackId,
      })
      continue
    }
    if (prev?.isOffset) {
      const prevTrue = prev.trueLatLng
      const sameTrue =
        Array.isArray(prevTrue) &&
        prevTrue.length >= 2 &&
        Math.abs(Number(prevTrue[0]) - Number(pin.latLng[0])) < 1e-7 &&
        Math.abs(Number(prevTrue[1]) - Number(pin.latLng[1])) < 1e-7
      if (sameTrue) {
        // Congela offset durante pan de câmera — evita teleport de meal/home.
        entries.set(pin.id, {
          displayLatLng: prev.displayLatLng || pin.latLng,
          trueLatLng: pin.latLng,
          groupId: prev.groupId ?? 0,
          isOffset: true,
          sideIndex: prev.sideIndex ?? 0,
          stackId: null,
        })
      } else {
        // True coords mudaram (ex.: troca de restaurante) — sem offset velho.
        entries.set(pin.id, {
          displayLatLng: pin.latLng,
          trueLatLng: pin.latLng,
          groupId: prev.groupId ?? 0,
          isOffset: false,
          sideIndex: 0,
          stackId: null,
        })
      }
      continue
    }
    if (prev) {
      entries.set(pin.id, {
        displayLatLng: prev.displayLatLng || pin.latLng,
        trueLatLng: pin.latLng,
        groupId: prev.groupId ?? 0,
        isOffset: false,
        sideIndex: prev.sideIndex ?? 0,
        stackId: prev.stackId ?? null,
      })
      continue
    }
    entries.set(pin.id, {
      displayLatLng: pin.latLng,
      trueLatLng: pin.latLng,
      groupId: 0,
      isOffset: false,
      sideIndex: 0,
      stackId: null,
    })
  }

  const stacks = prevStacks
    .map((stack) => {
      const memberIds = (stack.memberIds || []).filter((id) => entries.has(id))
      if (memberIds.length < 2) return null
      const first = entries.get(memberIds[0])
      const displayLatLng = first?.displayLatLng || stack.displayLatLng
      return {
        ...stack,
        memberIds,
        displayLatLng,
        trueLatLng: displayLatLng,
      }
    })
    .filter(Boolean)

  return { entries, stacks }
}

/**
 * @param {{
 *   kind: PinKind,
 *   order?: number | null,
 *   sideIndex?: number,
 *   isHighlighted?: boolean,
 *   isStack?: boolean,
 * }} opts
 */
export function pinZIndexOffset({
  kind,
  order = 0,
  sideIndex = 0,
  isHighlighted = false,
  isStack = false,
}) {
  const highlightBoost = isHighlighted ? 1000 : 0
  // Paradas / stack acima de meals para o card da parada ser clicável
  // quando os ícones ainda se tocam um pouco.
  if (isStack) {
    const o = Number.isFinite(Number(order)) ? Number(order) : 0
    return highlightBoost + 450 + o
  }
  if (kind === 'stop') {
    const o = Number.isFinite(Number(order)) ? Number(order) : 0
    return highlightBoost + 300 + o
  }
  if (kind === 'meal') {
    return highlightBoost + 120 + sideIndex
  }
  return highlightBoost + 80 + sideIndex
}

/**
 * @param {{
 *   markers?: Array<{ activityId?: string, coords: LatLngTuple, order?: number }>,
 *   mealMarkers?: Array<{ activityId?: string, slotKey?: string, coords: LatLngTuple }>,
 *   accommodations?: Array<{ id?: string, coords: LatLngTuple }>,
 *   showMeals?: boolean,
 * }} input
 * @returns {LayoutPin[]}
 */
export function buildLayoutPins({
  markers = [],
  mealMarkers = [],
  accommodations = [],
  showMeals = true,
}) {
  /** @type {LayoutPin[]} */
  const pins = []

  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i]
    if (!m?.coords) continue
    pins.push({
      id: layoutPinId('stop', m.activityId, m.coords, i),
      kind: 'stop',
      latLng: m.coords,
      order: m.order ?? i + 1,
    })
  }

  if (showMeals) {
    for (let i = 0; i < mealMarkers.length; i += 1) {
      const m = mealMarkers[i]
      if (!m?.coords) continue
      pins.push({
        id: layoutPinId('meal', m.activityId ?? m.slotKey, m.coords, i),
        kind: 'meal',
        latLng: m.coords,
        order: i + 1,
      })
    }
  }

  for (let i = 0; i < accommodations.length; i += 1) {
    const a = accommodations[i]
    if (!a?.coords) continue
    pins.push({
      id: layoutPinId('home', a.id, a.coords, i),
      kind: 'home',
      latLng: a.coords,
      order: i + 1,
    })
  }

  return pins
}

/**
 * @param {'stop' | 'meal' | 'home'} kind
 * @param {string | number | null | undefined} key
 * @param {LatLngTuple} coords
 * @param {number} idx
 */
export function layoutPinId(kind, key, coords, idx) {
  if (key != null && String(key) !== '') return `${kind}:${key}`
  return `${kind}:${coords[0]},${coords[1]}:${idx}`
}

/**
 * Ids de paradas que pertencem a um stack (não renderizar pin individual).
 * @param {StopStack[]} stacks
 * @returns {Set<string>}
 */
export function stackedStopIdSet(stacks) {
  const set = new Set()
  for (const s of stacks || []) {
    for (const id of s.memberIds || []) set.add(id)
  }
  return set
}
