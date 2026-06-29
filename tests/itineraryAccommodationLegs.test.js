import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  coordsNearlyEqual,
  findHotelSideOverlap,
  isReversePath,
  isSingleStopRoundTrip,
  resolveAccommodationLegDisplay,
} from '../src/utils/itineraryAccommodationLegs.js'

const H = [48.87, 2.33]
const A = [48.871, 2.331]
const B = [48.872, 2.332]
const P = [48.86, 2.34]

describe('itineraryAccommodationLegs', () => {
  it('coordsNearlyEqual tolera pequena diferença', () => {
    assert.equal(coordsNearlyEqual([1, 2], [1.0001, 2.0001]), true)
    assert.equal(coordsNearlyEqual([1, 2], [1.01, 2]), false)
  })

  it('isReversePath detecta caminhos espelhados', () => {
    const green = [H, A, P]
    const red = [P, A, H]
    assert.equal(isReversePath(green, red), true)
  })

  it('isSingleStopRoundTrip com uma parada ou ida/volta no mesmo ponto', () => {
    assert.equal(isSingleStopRoundTrip([{ coords: P }]), true)
    assert.equal(
      isSingleStopRoundTrip([{ coords: P }, { coords: P }]),
      true,
    )
    assert.equal(
      isSingleStopRoundTrip([{ coords: P }, { coords: [48.9, 2.4] }]),
      false,
    )
  })

  it('resolveAccommodationLegDisplay unifica em amarelo quando ida = volta espelhada', () => {
    const toFirst = [H, A, P]
    const fromLast = [P, A, H]
    const result = resolveAccommodationLegDisplay({
      toFirst,
      fromLast,
      showLegs: true,
      markers: [{ coords: P }],
    })
    assert.deepEqual(result.yellow, toFirst)
    assert.deepEqual(result.green, [])
    assert.deepEqual(result.red, [])
  })

  it('resolveAccommodationLegDisplay retorna vazio quando showLegs é false', () => {
    const result = resolveAccommodationLegDisplay({
      toFirst: [H, P],
      fromLast: [P, H],
      showLegs: false,
      markers: [{ coords: P }],
    })
    assert.deepEqual(result, { yellow: [], green: [], red: [] })
  })

  it('resolveAccommodationLegDisplay mantém verde e vermelho quando caminhos diferem', () => {
    const toFirst = [H, A, P]
    const fromLast = [P, B, H]
    const result = resolveAccommodationLegDisplay({
      toFirst,
      fromLast,
      showLegs: true,
      markers: [{ coords: P }, { coords: [48.9, 2.4] }],
    })
    assert.deepEqual(result.yellow, [])
    assert.deepEqual(result.green, toFirst)
    assert.deepEqual(result.red, fromLast)
  })

  it('findHotelSideOverlap divide trecho comum em amarelo', () => {
    const green = [H, A, B, P]
    const red = [P, B, A, H]
    const split = findHotelSideOverlap(green, red)
    assert.ok(split)
    assert.ok(split.yellow.length >= 2)
    assert.ok(split.yellow.every((p, i) => coordsNearlyEqual(p, green[i])))
  })

  it('resolveAccommodationLegDisplay aplica overlap parcial', () => {
    const toFirst = [H, A, B, P]
    const fromLast = [P, B, A, H]
    const result = resolveAccommodationLegDisplay({
      toFirst,
      fromLast,
      showLegs: true,
      markers: [{ coords: P }, { coords: [48.9, 2.4] }],
    })
    assert.ok(result.yellow.length >= 2)
    assert.equal(result.green.length === 0 || result.green.length >= 2, true)
    assert.equal(result.red.length === 0 || result.red.length >= 2, true)
  })
})
