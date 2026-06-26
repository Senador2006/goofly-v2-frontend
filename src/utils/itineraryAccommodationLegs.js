/**
 * Resolve como desenhar pernas hospedagem ↔ paradas (verde/vermelha/amarela unificada).
 */

const COORD_EPSILON = 0.00015

/** @param {[number, number] | null | undefined} a @param {[number, number] | null | undefined} b */
export function coordsNearlyEqual(a, b, epsilon = COORD_EPSILON) {
  if (!a || !b) return false
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

/** @param {[number, number][]} positions */
function reversePositions(positions) {
  return [...positions].reverse()
}

/** @param {[number, number][]} a @param {[number, number][]} b */
export function positionsNearlyEqual(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return false
  return a.every((p, i) => coordsNearlyEqual(p, b[i]))
}

/** @param {[number, number][]} a @param {[number, number][]} b */
export function isReversePath(a, b) {
  if (!a?.length || !b?.length) return false
  return positionsNearlyEqual(a, reversePositions(b))
}

/** @param {{ coords: [number, number] }[]} markers */
export function isSingleStopRoundTrip(markers) {
  if (!markers?.length) return false
  if (markers.length === 1) return true
  return coordsNearlyEqual(markers[0].coords, markers[markers.length - 1].coords)
}

/**
 * Trecho comum saindo da hospedagem (prefixo de green = sufixo de red).
 * @param {[number, number][]} green
 * @param {[number, number][]} red
 */
export function findHotelSideOverlap(green, red) {
  if (!green?.length || !red?.length) return null

  let i = 0
  let j = red.length - 1
  while (i < green.length && j >= 0 && coordsNearlyEqual(green[i], red[j])) {
    i += 1
    j -= 1
  }

  if (i < 2) return null

  const yellow = green.slice(0, i)
  const greenRest = green.slice(i - 1)
  const redRest = red.slice(0, j + 2)

  const hasGreen = greenRest.length >= 2
  const hasRed = redRest.length >= 2

  if (!hasGreen && !hasRed) {
    return { yellow, green: [], red: [] }
  }

  return {
    yellow,
    green: hasGreen ? greenRest : [],
    red: hasRed ? redRest : [],
  }
}

/**
 * @param {{
 *   toFirst: [number, number][],
 *   fromLast: [number, number][],
 *   showLegs: boolean,
 *   markers: { coords: [number, number] }[],
 * }} input
 * @returns {{ yellow: [number, number][], green: [number, number][], red: [number, number][] }}
 */
export function resolveAccommodationLegDisplay({ toFirst, fromLast, showLegs, markers }) {
  const empty = { yellow: [], green: [], red: [] }
  if (!showLegs || toFirst.length < 2 || fromLast.length < 2) return empty

  if (isSingleStopRoundTrip(markers) || isReversePath(toFirst, fromLast)) {
    return { yellow: toFirst, green: [], red: [] }
  }

  const split = findHotelSideOverlap(toFirst, fromLast)
  if (split) {
    return {
      yellow: split.yellow,
      green: split.green,
      red: split.red,
    }
  }

  return { yellow: [], green: toFirst, red: fromLast }
}
