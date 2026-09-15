import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDayEditUnits,
  expandUnitsToOrderById,
  getUnitDragId,
  moveUnitToIndexInSameDay,
  removeDayUnit,
  removeMealOptionFromSlot,
  addMealOptionToSlot,
  reorderUnitInSameDay,
  assignDayUnitToDay,
  getMealSlotStableId,
  MAX_MEAL_SLOT_OPTIONS,
} from '../src/utils/itineraryDayUnits.js'
import { getActivityDayNumber, sortDayActivities } from '../src/utils/itineraryDayHelpers.js'
import { buildDayTimelineItems } from '../src/utils/itineraryMealHelpers.js'

const emptyMap = new Map()

const museum = {
  id: 'act-1',
  title: 'Museu',
  day: 1,
  order: 0,
  startTime: '10:00',
  endTime: '11:30',
}

const lunchA = {
  id: 'meal-1',
  title: 'Bistrô A',
  day: 1,
  order: 1,
  startTime: '12:30',
  endTime: '13:30',
  mealType: 'lunch',
  isMealRecommendation: true,
  mealPosition: 'near_previous',
}

const lunchB = {
  id: 'meal-2',
  title: 'Bistrô B',
  day: 1,
  order: 2,
  startTime: '12:30',
  endTime: '13:30',
  mealType: 'lunch',
  isMealRecommendation: true,
  mealPosition: 'on_the_way',
}

const park = {
  id: 'act-2',
  title: 'Parque',
  day: 1,
  order: 3,
  startTime: '15:00',
  endTime: '16:30',
}

function dayTitles(all, dayNum = 1) {
  return sortDayActivities(
    all.filter((a) => getActivityDayNumber(a, emptyMap) === dayNum),
  ).map((a) => a.title)
}

describe('itineraryDayUnits', () => {
  it('buildDayEditUnits agrupa 2 opções de almoço em uma unidade', () => {
    const units = buildDayEditUnits([museum, lunchA, lunchB, park], 1)
    assert.equal(units.length, 3)
    assert.equal(units[0].type, 'activity')
    assert.equal(units[0].id, 'act-1')
    assert.equal(units[1].type, 'mealSlot')
    assert.equal(units[1].ids.length, 2)
    assert.equal(units[2].type, 'activity')
    assert.equal(getUnitDragId(units[1]), getMealSlotStableId(1, 'lunch'))
  })

  it('reorderUnitInSameDay move parada pulando o bloco de meal inteiro', () => {
    const base = [museum, lunchA, lunchB, park]
    const next = reorderUnitInSameDay(base, emptyMap, 1, 'act-1', 1)
    assert.deepEqual(dayTitles(next), [
      'Bistrô A',
      'Bistrô B',
      'Museu',
      'Parque',
    ])
    const units = buildDayEditUnits(
      sortDayActivities(next.filter((a) => a.day === 1)),
      1,
    )
    assert.equal(units[0].type, 'mealSlot')
    assert.equal(units[0].ids.length, 2)
    assert.equal(units[1].id, 'act-1')
  })

  it('moveUnitToIndexInSameDay não mistura parada com opção individual', () => {
    const base = [museum, lunchA, lunchB, park]
    const next = moveUnitToIndexInSameDay(base, emptyMap, 1, 'act-2', 1)
    assert.deepEqual(dayTitles(next), [
      'Museu',
      'Parque',
      'Bistrô A',
      'Bistrô B',
    ])
    const mealOrders = next
      .filter((a) => a.id === 'meal-1' || a.id === 'meal-2')
      .map((a) => a.order)
      .sort((a, b) => a - b)
    assert.equal(mealOrders[1] - mealOrders[0], 1)
  })

  it('removeDayUnit não exclui bloco de refeição', () => {
    const base = [museum, lunchA, lunchB, park]
    const slotId = getMealSlotStableId(1, 'lunch')
    const next = removeDayUnit(base, emptyMap, 1, slotId)
    assert.deepEqual(dayTitles(next), ['Museu', 'Bistrô A', 'Bistrô B', 'Parque'])
  })

  it('removeMealOptionFromSlot remove uma opção e mantém o bloco', () => {
    const base = [museum, lunchA, lunchB, park]
    const slotId = getMealSlotStableId(1, 'lunch')
    const next = removeMealOptionFromSlot(base, emptyMap, 1, slotId, 'meal-1')
    assert.deepEqual(dayTitles(next), ['Museu', 'Bistrô B', 'Parque'])
    const alone = removeMealOptionFromSlot(next, emptyMap, 1, slotId, 'meal-2')
    // Mantém pelo menos 1
    assert.deepEqual(dayTitles(alone), ['Museu', 'Bistrô B', 'Parque'])
  })

  it('addMealOptionToSlot adiciona até o máximo', () => {
    const base = [museum, lunchA, lunchB, park]
    const slotId = getMealSlotStableId(1, 'lunch')
    const withThird = addMealOptionToSlot(base, emptyMap, 1, slotId, {
      name: 'Bistrô C',
      coordinates: { lat: 1, lng: 2 },
    })
    assert.equal(
      withThird.filter((a) => a.isMealRecommendation).length,
      3,
    )
    assert.equal(MAX_MEAL_SLOT_OPTIONS, 3)
    const capped = addMealOptionToSlot(withThird, emptyMap, 1, slotId, {
      name: 'Bistrô D',
    })
    assert.equal(
      capped.filter((a) => a.isMealRecommendation).length,
      3,
    )
  })

  it('assignDayUnitToDay move o slot inteiro', () => {
    const base = [
      museum,
      lunchA,
      lunchB,
      park,
      { id: 'd2', title: 'Outro', day: 2, order: 0, startTime: '10:00' },
    ]
    const slotId = getMealSlotStableId(1, 'lunch')
    const next = assignDayUnitToDay(base, emptyMap, 1, slotId, 2)
    assert.deepEqual(dayTitles(next, 1), ['Museu', 'Parque'])
    assert.deepEqual(dayTitles(next, 2), ['Outro', 'Bistrô A', 'Bistrô B'])
  })

  it('slotId estável não muda quando o horário das opções muda', () => {
    const before = buildDayTimelineItems([lunchA, lunchB], 1)
    const after = buildDayTimelineItems(
      [
        { ...lunchA, startTime: '13:45', endTime: '14:45' },
        { ...lunchB, startTime: '13:45', endTime: '14:45' },
      ],
      1,
    )
    assert.equal(before[0].slotId, after[0].slotId)
    assert.equal(before[0].slotKey, after[0].slotKey)
  })

  it('expandUnitsToOrderById atribui order contíguo às opções', () => {
    const units = buildDayEditUnits([museum, lunchA, lunchB, park], 1)
    const orderById = expandUnitsToOrderById(units)
    assert.equal(orderById.get('act-1'), 0)
    assert.equal(orderById.get('meal-1'), 1)
    assert.equal(orderById.get('meal-2'), 2)
    assert.equal(orderById.get('act-2'), 3)
  })
})
