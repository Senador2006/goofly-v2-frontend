import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MEAL_STOP_ROUTE_MIN_ZOOM,
  coordsForRoutedDay,
  mealSelectionCacheSignature,
  resolveDisplayedDayRoute,
  resolveLodgingLegEndpoints,
  shouldBlankRouteForNextFetch,
  withMealSelectionCacheKey,
} from '../src/utils/itineraryMapRoute.js'

const breakfast = { id: 'breakfast', order: 1, startTime: '08:00', mealType: 'breakfast' }
const louvre = { id: 'a1', order: 2, startTime: '10:00' }
const lunchA = { id: 'lunch-a', order: 3, startTime: '12:30', mealType: 'lunch' }
const lunchB = { id: 'lunch-b', order: 4, startTime: '12:30', mealType: 'lunch' }
const orsay = { id: 'a2', order: 5, startTime: '15:00' }
const dinner = { id: 'dinner', order: 6, startTime: '20:00', mealType: 'dinner' }

const coords = new Map([
  ['breakfast', [48.866, 2.31]],
  ['a1', [48.8606, 2.3376]],
  ['lunch-a', [48.858, 2.325]],
  ['a2', [48.855, 2.34]],
  ['dinner', [48.85, 2.36]],
])

describe('cache da rota por refeição escolhida', () => {
  it('a assinatura não muda com a ordem das chaves', () => {
    const a = mealSelectionCacheSignature({ '1|dinner': 'dinner', '1|breakfast': 'breakfast' })
    const b = mealSelectionCacheSignature({ '1|breakfast': 'breakfast', '1|dinner': 'dinner' })
    assert.equal(a, b)
    assert.notEqual(a, mealSelectionCacheSignature({ '1|breakfast': 'outro' }))
  })

  it('a chave do dia só ganha a refeição quando há escolha', () => {
    assert.equal(withMealSelectionCacheKey('trip:1', {}), 'trip:1')
    assert.equal(withMealSelectionCacheKey('trip:1', null), 'trip:1')
    const withMeal = withMealSelectionCacheKey('trip:1', { '1|lunch': 'lunch-b' })
    assert.match(withMeal, /^trip:1:meals:/)
    assert.notEqual(
      withMeal,
      withMealSelectionCacheKey('trip:1', { '1|lunch': 'lunch-a' }),
    )
  })
})

describe('modelo de traço conforme o zoom', () => {
  const activity = [
    [48.86, 2.33],
    [48.85, 2.34],
  ]
  const via = [
    [48.866, 2.31],
    [48.86, 2.33],
    [48.85, 2.36],
  ]
  const anchors = [{ slotKey: '1|breakfast', positions: [[48.86, 2.33], [48.866, 2.31]] }]

  it('abaixo do zoom de foco a refeição fica no traço ligado à parada', () => {
    const view = resolveDisplayedDayRoute({
      zoom: MEAL_STOP_ROUTE_MIN_ZOOM - 1,
      showMeals: true,
      activityPositions: activity,
      viaMealPositions: via,
      mealAnchorLegs: anchors,
    })
    assert.equal(view.mealsOnRoad, false)
    assert.deepEqual(view.positions, activity)
    assert.equal(view.mealAnchorLegs.length, 1)
  })

  it('no zoom de foco e mais perto a refeição entra na rota e o traço some', () => {
    const view = resolveDisplayedDayRoute({
      zoom: MEAL_STOP_ROUTE_MIN_ZOOM,
      showMeals: true,
      activityPositions: activity,
      viaMealPositions: via,
      mealAnchorLegs: anchors,
    })
    assert.equal(view.mealsOnRoad, true)
    assert.deepEqual(view.positions, via)
    assert.deepEqual(view.mealAnchorLegs, [])
  })

  it('sem geometria via refeição o traço da parada permanece, mesmo perto', () => {
    const view = resolveDisplayedDayRoute({
      zoom: 16,
      showMeals: true,
      activityPositions: activity,
      viaMealPositions: [],
      mealAnchorLegs: anchors,
    })
    assert.equal(view.mealsOnRoad, false)
    assert.deepEqual(view.positions, activity)
    assert.equal(view.mealAnchorLegs.length, 1)
  })

  it('com refeições ocultas o mapa não troca a rota das paradas', () => {
    const view = resolveDisplayedDayRoute({
      zoom: 16,
      showMeals: false,
      activityPositions: activity,
      viaMealPositions: via,
      mealAnchorLegs: anchors,
    })
    assert.equal(view.mealsOnRoad, false)
    assert.deepEqual(view.positions, activity)
    assert.deepEqual(view.mealAnchorLegs, [])
  })
})

describe('hospedagem na primeira e na última refeição do dia', () => {
  it('café e jantar escolhidos viram as pontas da perna', () => {
    const ordered = coordsForRoutedDay(
      [orsay, breakfast, dinner, louvre, lunchB, lunchA],
      coords,
    )
    const ends = resolveLodgingLegEndpoints(ordered)
    assert.deepEqual(ordered, [
      coords.get('breakfast'),
      coords.get('a1'),
      coords.get('lunch-a'),
      coords.get('a2'),
      coords.get('dinner'),
    ])
    assert.deepEqual(ends.toFirst, coords.get('breakfast'))
    assert.deepEqual(ends.fromLast, coords.get('dinner'))
  })

  it('almoço no meio não muda saída nem volta da hospedagem', () => {
    const middleOnly = new Map([
      ['a1', coords.get('a1')],
      ['lunch-a', coords.get('lunch-a')],
      ['a2', coords.get('a2')],
    ])
    const ordered = coordsForRoutedDay([louvre, lunchA, orsay], middleOnly)
    const ends = resolveLodgingLegEndpoints(ordered)
    assert.deepEqual(ends.toFirst, coords.get('a1'))
    assert.deepEqual(ends.fromLast, coords.get('a2'))
    assert.equal(ordered.length, 3)
  })

  it('sem pontos não inventa perna', () => {
    assert.deepEqual(resolveLodgingLegEndpoints([]), { toFirst: null, fromLast: null })
  })
})

describe('troca de refeição não apaga a rota já desenhada', () => {
  it('muda o dia: limpa', () => {
    assert.equal(
      shouldBlankRouteForNextFetch({
        previousDay: 1,
        nextDay: 2,
        previousMealSig: 'a',
        nextMealSig: 'a',
      }),
      true,
    )
  })

  it('mesmo dia, outra refeição: mantém o traço até a nova rota chegar', () => {
    assert.equal(
      shouldBlankRouteForNextFetch({
        previousDay: 1,
        nextDay: 1,
        previousMealSig: '1|lunch=lunch-a',
        nextMealSig: '1|lunch=lunch-b',
      }),
      false,
    )
  })

  it('primeira carga e mudança de parada ainda limpam', () => {
    assert.equal(
      shouldBlankRouteForNextFetch({
        previousDay: null,
        nextDay: 1,
        previousMealSig: '',
        nextMealSig: 'x',
      }),
      true,
    )
    assert.equal(
      shouldBlankRouteForNextFetch({
        previousDay: 1,
        nextDay: 1,
        previousMealSig: '1|lunch=lunch-a',
        nextMealSig: '1|lunch=lunch-a',
      }),
      true,
    )
  })
})
