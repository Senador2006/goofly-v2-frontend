import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  COLLISION_PX,
  buildLayoutPins,
  computePinLayout,
  groupByProximity,
  layoutPinId,
  pinZIndexOffset,
  stackedStopIdSet,
} from '../src/utils/itineraryMapPinLayout.js'

/** Projeção linear estável: 1° ≈ 100000 px (só para testes). */
function project(ll) {
  return { x: ll[1] * 1e5, y: -ll[0] * 1e5 }
}
function unproject(pt) {
  return [-pt.y / 1e5, pt.x / 1e5]
}

const opts = { project, unproject }

describe('itineraryMapPinLayout', () => {
  it('groupByProximity agrupa pontos próximos', () => {
    const groups = groupByProximity(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 500, y: 0 },
      ],
      COLLISION_PX,
    )
    assert.equal(groups[0], groups[1])
    assert.notEqual(groups[0], groups[2])
  })

  it('paradas no mesmo ponto viram um stack (sem offsets circulares)', () => {
    const same = [48.85, 2.35]
    const { entries, stacks } = computePinLayout(
      [
        { id: 'stop:a', kind: 'stop', latLng: same, order: 1 },
        { id: 'stop:b', kind: 'stop', latLng: same, order: 2 },
        { id: 'stop:c', kind: 'stop', latLng: same, order: 3 },
      ],
      opts,
    )
    assert.equal(stacks.length, 1)
    assert.equal(stacks[0].memberIds.length, 3)
    assert.equal(entries.get('stop:a').isOffset, false)
    assert.equal(entries.get('stop:b').isOffset, false)
    assert.equal(entries.get('stop:a').stackId, stacks[0].stackId)
    // Todos compartilha o mesmo display (centróide), sem fan
    assert.deepEqual(entries.get('stop:a').displayLatLng, entries.get('stop:b').displayLatLng)
    assert.deepEqual(entries.get('stop:a').trueLatLng, same)
  })

  it('1 stop + 1 meal: stop ancorado, meal só com offset lateral', () => {
    const same = [41.9, 12.5]
    const { entries, stacks } = computePinLayout(
      [
        { id: 'stop:1', kind: 'stop', latLng: same, order: 1 },
        { id: 'meal:1', kind: 'meal', latLng: same, order: 1 },
      ],
      opts,
    )
    assert.equal(stacks.length, 0)
    const stop = entries.get('stop:1')
    const meal = entries.get('meal:1')
    assert.equal(stop.isOffset, false)
    assert.deepEqual(stop.displayLatLng, same)
    assert.equal(meal.isOffset, true)
    assert.notDeepEqual(meal.displayLatLng, same)
    assert.deepEqual(meal.trueLatLng, same)
    // Offset é para o leste (+x), não um círculo com ângulos variados
    const stopPx = project(stop.displayLatLng)
    const mealPx = project(meal.displayLatLng)
    assert.ok(mealPx.x > stopPx.x)
  })

  it('várias meals no mesmo ponto ficam em coluna lateral (não em círculo)', () => {
    const same = [40.4, -3.7]
    const { entries } = computePinLayout(
      [
        { id: 'stop:1', kind: 'stop', latLng: same, order: 1 },
        { id: 'meal:1', kind: 'meal', latLng: same, order: 1 },
        { id: 'meal:2', kind: 'meal', latLng: same, order: 2 },
        { id: 'meal:3', kind: 'meal', latLng: same, order: 3 },
      ],
      opts,
    )
    const m1 = project(entries.get('meal:1').displayLatLng)
    const m2 = project(entries.get('meal:2').displayLatLng)
    const m3 = project(entries.get('meal:3').displayLatLng)
    // Mesmo x (coluna), ys distintos
    assert.ok(Math.abs(m1.x - m2.x) < 1e-6)
    assert.ok(Math.abs(m2.x - m3.x) < 1e-6)
    assert.notEqual(m1.y, m2.y)
    assert.notEqual(m2.y, m3.y)
  })

  it('pins distantes no zoom não recebem offset nem stack', () => {
    const { entries, stacks } = computePinLayout(
      [
        { id: 'stop:1', kind: 'stop', latLng: [48.85, 2.35], order: 1 },
        { id: 'meal:1', kind: 'meal', latLng: [48.851, 2.35], order: 1 },
      ],
      opts,
    )
    assert.equal(stacks.length, 0)
    assert.equal(entries.get('stop:1').isOffset, false)
    assert.equal(entries.get('meal:1').isOffset, false)
  })

  it('stackedStopIdSet cobre membros do stack', () => {
    const set = stackedStopIdSet([
      { stackId: 's1', memberIds: ['stop:a', 'stop:b'], groupId: 0, displayLatLng: [0, 0], trueLatLng: [0, 0] },
    ])
    assert.equal(set.has('stop:a'), true)
    assert.equal(set.has('stop:c'), false)
  })

  it('buildLayoutPins e layoutPinId alinham ids', () => {
    const pins = buildLayoutPins({
      markers: [{ activityId: 'a1', coords: [1, 2], order: 1 }],
      mealMarkers: [{ activityId: 'm1', slotKey: 'lunch@12:00', coords: [1, 2] }],
      accommodations: [{ id: 'h1', coords: [1, 2] }],
      showMeals: true,
    })
    assert.deepEqual(
      pins.map((p) => p.id),
      [
        layoutPinId('stop', 'a1', [1, 2], 0),
        layoutPinId('meal', 'm1', [1, 2], 0),
        layoutPinId('home', 'h1', [1, 2], 0),
      ],
    )
  })

  it('pinZIndexOffset: paradas acima de meals; highlight sobe', () => {
    assert.equal(pinZIndexOffset({ kind: 'stop', order: 3 }), 303)
    assert.equal(pinZIndexOffset({ kind: 'meal', sideIndex: 1 }), 121)
    assert.ok(
      pinZIndexOffset({ kind: 'stop', order: 1 }) >
        pinZIndexOffset({ kind: 'meal', sideIndex: 0 }),
    )
    assert.equal(pinZIndexOffset({ kind: 'meal', sideIndex: 0, isHighlighted: true }), 1120)
  })
})

describe('ItineraryDayMap pin overlap contract', () => {
  const dayMapPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../src/components/itinerary/ItineraryDayMap.jsx',
  )
  const dayMapSource = readFileSync(dayMapPath, 'utf8')
  const stackPopupPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../src/components/itinerary/ItineraryMapStopStackPopup.jsx',
  )
  const stackPopupSource = readFileSync(stackPopupPath, 'utf8')

  it('usa stack popup com card completo da parada selecionada', () => {
    assert.match(dayMapSource, /PinOverlapLayoutSync/)
    assert.match(dayMapSource, /ItineraryMapStopStackPopup/)
    assert.match(dayMapSource, /getStackedStopIcon/)
    assert.match(dayMapSource, /stackedStopIdSet/)
    assert.doesNotMatch(dayMapSource, /fanAngles/)
    assert.match(stackPopupSource, /paradas neste ponto/)
    assert.match(stackPopupSource, /ItineraryMapStopPopup/)
  })

  it('meal legs continuam nas coords verdadeiras do marker', () => {
    assert.match(
      dayMapSource,
      /positions:\s*\[\s*anchorMarker\.coords,\s*mealMarker\.coords\s*\]/,
    )
  })
})
