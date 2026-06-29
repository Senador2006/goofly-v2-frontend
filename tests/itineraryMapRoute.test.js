import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  apiRouteMatchesVisibleActivities,
  buildVisibleActivityIdSet,
  mergeAccommodationsForMap,
  resolveLegPolylinePositions,
  resolveMapMarkers,
  resolvePolylinePositions,
} from '../src/utils/itineraryMapRoute.js'

const dayMapPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/components/itinerary/ItineraryDayMap.jsx',
)
const dayMapSource = readFileSync(dayMapPath, 'utf8')

describe('itineraryMapRoute helpers', () => {
  it('buildVisibleActivityIdSet collects stable ids', () => {
    const ids = buildVisibleActivityIdSet([
      { id: 'a1' },
      { placeId: 'p2' },
      { place_id: 'p3' },
    ])
    assert.deepEqual([...ids], ['a1', 'p2', 'p3'])
  })

  it('apiRouteMatchesVisibleActivities rejects hidden markers', () => {
    const visible = buildVisibleActivityIdSet([{ id: 'a1' }, { id: 'a2' }])
    assert.equal(
      apiRouteMatchesVisibleActivities(
        { markers: [{ activityId: 'a1' }, { activityId: 'a2' }] },
        visible,
      ),
      true,
    )
    assert.equal(
      apiRouteMatchesVisibleActivities(
        { markers: [{ activityId: 'a1' }, { activityId: 'hidden' }] },
        visible,
      ),
      false,
    )
  })

  it('resolveMapMarkers never falls back to apiMarkers when restricted', () => {
    const local = [{ activityId: 'a1', coords: [1, 2] }]
    const api = [{ activityId: 'hidden', coords: [3, 4] }]
    assert.deepEqual(
      resolveMapMarkers({ localMarkers: local, apiMarkers: api, routeRestricted: true }),
      local,
    )
    assert.deepEqual(
      resolveMapMarkers({ localMarkers: [], apiMarkers: api, routeRestricted: true }),
      [],
    )
    assert.deepEqual(
      resolveMapMarkers({ localMarkers: [], apiMarkers: api, routeRestricted: false }),
      api,
    )
  })

  it('resolvePolylinePositions ignores unsafe API geometry when restricted', () => {
    const markers = [
      { coords: [48.85, 2.35] },
      { coords: [48.86, 2.36] },
    ]
    const routeData = {
      route: {
        geometry: {
          coordinates: [
            [2.35, 48.85],
            [2.5, 48.9],
            [2.36, 48.86],
          ],
        },
      },
    }

    const safe = resolvePolylinePositions({
      routePayloadValid: true,
      routeData,
      markers,
      routeRestricted: true,
      apiRouteSafeForPreview: true,
    })
    assert.equal(safe.length, 3)

    const fallback = resolvePolylinePositions({
      routePayloadValid: true,
      routeData,
      markers,
      routeRestricted: true,
      apiRouteSafeForPreview: false,
    })
    assert.deepEqual(fallback, markers.map((m) => m.coords))
  })

  it('resolveLegPolylinePositions uses API geometry or straight fallback', () => {
    const from = [48.87, 2.33]
    const to = [48.86, 2.34]
    const straight = resolveLegPolylinePositions(null, from, to)
    assert.deepEqual(straight, [from, to])

    const fromApi = resolveLegPolylinePositions(
      {
        route: {
          geometry: {
            coordinates: [
              [2.33, 48.87],
              [2.34, 48.86],
            ],
          },
        },
      },
      from,
      to,
    )
    assert.deepEqual(fromApi, [
      [48.87, 2.33],
      [48.86, 2.34],
    ])
  })

  it('mergeAccommodationsForMap prioriza prop com coords e deduplica por id', () => {
    const merged = mergeAccommodationsForMap(
      [{ id: 'acc-1', name: 'Hotel', coordinates: { latitude: 1, longitude: 2 } }],
      [{ id: 'acc-1', name: 'API', coordinates: { latitude: 3, longitude: 4 } }],
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0].name, 'Hotel')
    assert.deepEqual(merged[0].coords, [1, 2])
  })

  it('mergeAccommodationsForMap combina múltiplas entradas', () => {
    const merged = mergeAccommodationsForMap(
      [
        { id: 'a1', name: 'H1', coordinates: { latitude: 1, longitude: 2 } },
        { id: 'a2', name: 'H2', coordinates: { latitude: 3, longitude: 4 } },
      ],
      [],
    )
    assert.equal(merged.length, 2)
  })
})

describe('ItineraryDayMap premium route contract', () => {
  it('supports routeRestricted and resolveMapMarkers', () => {
    assert.match(dayMapSource, /routeRestricted/)
    assert.match(dayMapSource, /resolveMapMarkers/)
    assert.match(dayMapSource, /apiRouteMatchesVisibleActivities/)
  })

  it('supports accommodation pin and leg polylines', () => {
    assert.match(dayMapSource, /accommodations/)
    assert.match(dayMapSource, /getHomeIcon/)
    assert.match(dayMapSource, /accommodationLegDisplay/)
    assert.match(dayMapSource, /mapAccommodations/)
    assert.match(dayMapSource, /#22c55e/)
    assert.match(dayMapSource, /#ef4444/)
    assert.match(dayMapSource, /#eab308/)
    assert.match(dayMapSource, /showAccommodationRoutes/)
    assert.match(dayMapSource, /MapAccommodationRoutesToggle/)
  })
})
