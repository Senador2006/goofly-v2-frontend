import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDayTimelineItems,
  buildDefaultMealSelections,
  buildMealMapMarkerHtml,
  filterRouteActivities,
  getMealPositionLabel,
  getMealSlotKey,
  getMealTypeLabel,
  isMealRecommendationActivity,
  mergeMealSelections,
  pickPrimaryMealOption,
  resolveSelectedMealForSlot,
  resolveMealRouteAnchor,
  resolveVisibleMealMarkers,
} from '../src/utils/itineraryMealHelpers.js'

const lunchA = {
  id: 'meal-1',
  placeId: 'suggested-lunch-a',
  name: 'Bistrô A',
  mealType: 'lunch',
  startTime: '12:30',
  isMealRecommendation: true,
  order: 20,
}

const lunchB = {
  id: 'meal-2',
  placeId: 'suggested-lunch-b',
  name: 'Bistrô B',
  mealType: 'lunch',
  startTime: '12:30',
  isMealRecommendation: true,
  mealPosition: 'on_the_way',
  order: 21,
}

const museum = {
  id: 'act-1',
  placeId: 'museum',
  name: 'Museu',
  startTime: '10:00',
  order: 1,
}

describe('itineraryMealHelpers', () => {
  it('isMealRecommendationActivity reconhece mealType e flag', () => {
    assert.equal(isMealRecommendationActivity(lunchA), true)
    assert.equal(isMealRecommendationActivity(museum), false)
  })

  it('isMealRecommendationActivity reconhece category food em activities[]', () => {
    assert.equal(
      isMealRecommendationActivity({
        name: 'Almoço — bistrô',
        category: 'food',
        startTime: '12:30',
      }),
      true,
    )
  })

  it('buildDayTimelineItems intercala refeição após order cronológico do backend', () => {
    const afternoon = {
      id: 'act-2',
      name: 'Tarde',
      startTime: '15:00',
      order: 3,
    }
    const items = buildDayTimelineItems([
      { ...museum, order: 0 },
      { ...lunchA, order: 1 },
      { ...lunchB, order: 2 },
      afternoon,
    ])
    assert.equal(items.length, 3)
    assert.equal(items[0].type, 'activity')
    assert.equal(items[0].act.id, 'act-1')
    assert.equal(items[1].type, 'mealSlot')
    assert.equal(items[1].options.length, 2)
    assert.equal(items[2].type, 'activity')
    assert.equal(items[2].act.id, 'act-2')
  })

  it('getMealSlotKey agrupa opções do mesmo slot', () => {
    assert.equal(getMealSlotKey(lunchA), getMealSlotKey(lunchB))
    assert.notEqual(getMealSlotKey(lunchA), getMealSlotKey({ ...lunchA, mealType: 'dinner' }))
  })

  it('buildDayTimelineItems intercala paradas e blocos de refeição', () => {
    const items = buildDayTimelineItems([museum, lunchA, lunchB])
    assert.equal(items.length, 2)
    assert.equal(items[0].type, 'activity')
    assert.equal(items[1].type, 'mealSlot')
    assert.equal(items[1].options.length, 2)
  })

  it('filterRouteActivities remove sugestões de refeição do mapa', () => {
    const route = filterRouteActivities([museum, lunchA, lunchB])
    assert.deepEqual(route.map((a) => a.id), ['act-1'])
  })

  it('labels PT-BR para tipo e posição', () => {
    assert.equal(getMealTypeLabel('lunch'), 'Almoço')
    assert.equal(getMealPositionLabel('on_the_way'), 'No caminho')
  })

  it('pickPrimaryMealOption prefere on_the_way', () => {
    const primary = pickPrimaryMealOption([lunchA, lunchB])
    assert.equal(primary.id, 'meal-2')
  })

  it('resolveSelectedMealForSlot usa seleção do usuário', () => {
    const selected = resolveSelectedMealForSlot([lunchA, lunchB], 'meal-1')
    assert.equal(selected.id, 'meal-1')
  })

  it('buildDefaultMealSelections pré-seleciona opção primária por slot', () => {
    const dayMap = new Map([['2026-06-09', 1]])
    const acts = [
      { ...museum, day: 1 },
      { ...lunchA, day: 1 },
      { ...lunchB, day: 1 },
    ]
    const selections = buildDefaultMealSelections(acts, dayMap)
    assert.equal(selections['lunch@12:30'], 'meal-2')
  })

  it('mergeMealSelections preserva escolha salva sobre o default', () => {
    const dayMap = new Map([['2026-06-09', 1]])
    const acts = [
      { ...museum, day: 1 },
      { ...lunchA, day: 1 },
      { ...lunchB, day: 1 },
    ]
    const merged = mergeMealSelections({ 'lunch@12:30': 'meal-1' }, acts, dayMap)
    assert.equal(merged['lunch@12:30'], 'meal-1')
  })

  it('resolveVisibleMealMarkers retorna 1 marker por slot', () => {
    const apiMarkers = [
      { activityId: 'meal-1', slotKey: 'lunch@12:30', coords: [1, 2] },
      { activityId: 'meal-2', slotKey: 'lunch@12:30', coords: [3, 4] },
    ]
    const slots = [{ slotKey: 'lunch@12:30', options: [lunchA, lunchB] }]
    const visible = resolveVisibleMealMarkers(apiMarkers, slots, {})
    assert.equal(visible.length, 1)
    assert.equal(visible[0].activityId, 'meal-2')
  })

  it('buildMealMapMarkerHtml usa material-icons-outlined da timeline', () => {
    const html = buildMealMapMarkerHtml('lunch')
    assert.match(html, /material-icons-outlined/)
    assert.match(html, /lunch_dining/)
    assert.doesNotMatch(html, /🍽|☕|🌙|🍴/)
  })

  it('resolveMealRouteAnchor near_previous usa parada anterior na timeline', () => {
    const afternoon = { id: 'act-2', name: 'Tarde', startTime: '15:00', order: 3 }
    const day = [museum, lunchA, lunchB, afternoon]
    const anchor = resolveMealRouteAnchor(day, { ...lunchA, mealPosition: 'near_previous' })
    assert.equal(anchor?.id, 'act-1')
  })

  it('resolveMealRouteAnchor near_next usa parada seguinte (não a última do dia)', () => {
    const afternoon = { id: 'act-2', name: 'Tarde', startTime: '15:00', order: 3 }
    const evening = { id: 'act-3', name: 'Noite', startTime: '19:00', order: 4 }
    const day = [museum, lunchA, lunchB, afternoon, evening]
    const anchor = resolveMealRouteAnchor(day, { ...lunchA, mealPosition: 'near_next' })
    assert.equal(anchor?.id, 'act-2')
  })

  it('resolveMealRouteAnchor on_the_way usa parada anterior', () => {
    const afternoon = { id: 'act-2', name: 'Tarde', startTime: '15:00', order: 3 }
    const day = [museum, lunchA, lunchB, afternoon]
    const anchor = resolveMealRouteAnchor(day, { ...lunchB, mealPosition: 'on_the_way' })
    assert.equal(anchor?.id, 'act-1')
  })
})
