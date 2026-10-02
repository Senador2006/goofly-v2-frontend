import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeActivitiesForPersist,
  slimActivityForPersist,
  slimActivitiesForRoutePreview,
} from '../src/utils/itineraryPersistPayload.js'
import { moveUnitToIndexInSameDay } from '../src/utils/itineraryDayUnits.js'

const emptyMap = new Map()

function fatActivity(day, i, kind = 'stop') {
  const longUrl = `https://cdn.example.com/places/${day}-${i}/` + 'a'.repeat(180) + '.jpg'
  const base = {
    id: `${kind}-${day}-${i}`,
    place_id: `place-${day}-${i}`,
    placeId: `place-${day}-${i}`,
    source: kind === 'meal' ? 'ai_suggested' : 'ai_suggested',
    day,
    dayNumber: day,
    day_number: day,
    order: i,
    title: kind === 'meal' ? `Meal ${day}-${i}` : `Stop ${day}-${i}`,
    name: kind === 'meal' ? `Meal ${day}-${i}` : `Stop ${day}-${i}`,
    description: 'Descrição longa '.repeat(20),
    category: kind === 'meal' ? 'food' : 'attraction',
    startTime: '10:00',
    start_time: '10:00',
    endTime: '11:00',
    end_time: '11:00',
    duration_minutes: 60,
    coordinates: { lat: 48.8 + day * 0.01, lng: 2.3 + i * 0.01 },
    image_url: longUrl,
    image_urls: [longUrl, longUrl + '2', longUrl + '3', longUrl + '4', longUrl + '5'],
    imageUrls: [longUrl],
    notes: 'nota interna',
    reasoning: 'raciocínio do agente '.repeat(10),
    aiReasoning: 'ai '.repeat(10),
    googleMapsUrl: 'https://maps.google.com/?q=test',
    ticketRequired: false,
  }
  if (kind === 'meal') {
    return {
      ...base,
      isMealRecommendation: true,
      mealType: i % 3 === 0 ? 'breakfast' : i % 3 === 1 ? 'lunch' : 'dinner',
      meal_type: i % 3 === 0 ? 'breakfast' : i % 3 === 1 ? 'lunch' : 'dinner',
      mealPosition: i,
    }
  }
  return base
}

describe('slimActivityForPersist', () => {
  it('remove galerias e aliases de imagem', () => {
    const slim = slimActivityForPersist(fatActivity(1, 0))
    assert.equal(slim.image_url, undefined)
    assert.equal(slim.image_urls, undefined)
    assert.equal(slim.imageUrls, undefined)
    assert.equal(slim.notes, undefined)
    assert.equal(slim.reasoning, undefined)
    assert.equal(slim.aiReasoning, undefined)
  })

  it('mantém campos editáveis essenciais', () => {
    const fat = {
      ...fatActivity(1, 0),
      ticketRequired: true,
      ticket_required: true,
      ticketUrl: 'https://tickets.example.com/x',
      ticket_url: 'https://tickets.example.com/x',
    }
    const slim = slimActivityForPersist(fat)
    assert.equal(slim.id, fat.id)
    assert.equal(slim.place_id, fat.place_id)
    assert.equal(slim.placeId, fat.placeId)
    assert.equal(slim.source, fat.source)
    assert.equal(slim.day, 1)
    assert.equal(slim.title, fat.title)
    assert.equal(slim.name, fat.name)
    assert.equal(slim.description, fat.description)
    assert.equal(slim.category, fat.category)
    assert.equal(slim.startTime, fat.startTime)
    assert.equal(slim.googleMapsUrl, fat.googleMapsUrl)
    assert.deepEqual(slim.coordinates, fat.coordinates)
    assert.equal(slim.ticketRequired, true)
    assert.equal(slim.ticketUrl, fat.ticketUrl)
  })

  it('mantém flags de refeição', () => {
    const slim = slimActivityForPersist(fatActivity(2, 1, 'meal'))
    assert.equal(slim.isMealRecommendation, true)
    assert.ok(slim.mealType)
    assert.ok(slim.meal_type)
  })
})

describe('normalizeActivitiesForPersist', () => {
  it('reindexa order por dia', () => {
    const acts = [
      { id: 'b', title: 'B', day: 1, order: 99, startTime: '11:00' },
      { id: 'a', title: 'A', day: 1, order: 50, startTime: '09:00' },
      { id: 'c', title: 'C', day: 2, order: 7, startTime: '10:00' },
    ]
    const out = normalizeActivitiesForPersist(acts, emptyMap, 1)
    const day1 = out.filter((a) => a.day === 1)
    assert.equal(day1[0].id, 'a')
    assert.equal(day1[0].order, 0)
    assert.equal(day1[1].id, 'b')
    assert.equal(day1[1].order, 1)
    assert.equal(out.find((a) => a.id === 'c')?.order, 0)
  })

  it('roteiro sintético de 6 dias fica abaixo de 100kb após slim', () => {
    const activities = []
    for (let day = 1; day <= 6; day++) {
      for (let i = 0; i < 4; i++) activities.push(fatActivity(day, i, 'stop'))
      for (let i = 0; i < 6; i++) activities.push(fatActivity(day, i + 10, 'meal'))
    }
    const fatBytes = JSON.stringify({ activities }).length
    assert.ok(fatBytes > 100_000, `fixture gorda deveria passar de 100kb (got ${fatBytes})`)

    const slimmed = normalizeActivitiesForPersist(activities, emptyMap, 1)
    const slimBytes = JSON.stringify({ activities: slimmed }).length
    assert.ok(
      slimBytes < 100_000,
      `payload slim de 6 dias deve ser < 100kb (got ${slimBytes})`,
    )
    for (const a of slimmed) {
      assert.equal(a.image_url, undefined)
      assert.equal(a.image_urls, undefined)
    }
  })

  it('mantém opções de meal contíguas após reorder unit-aware + persist', () => {
    const base = [
      {
        id: 'stop-a',
        title: 'Museu',
        day: 1,
        order: 0,
        startTime: '10:00',
        endTime: '11:00',
      },
      {
        id: 'meal-1',
        title: 'Lunch A',
        day: 1,
        order: 1,
        startTime: '12:30',
        endTime: '13:30',
        mealType: 'lunch',
        isMealRecommendation: true,
      },
      {
        id: 'meal-2',
        title: 'Lunch B',
        day: 1,
        order: 2,
        startTime: '12:30',
        endTime: '13:30',
        mealType: 'lunch',
        isMealRecommendation: true,
      },
      {
        id: 'stop-b',
        title: 'Parque',
        day: 1,
        order: 3,
        startTime: '15:00',
        endTime: '16:00',
      },
    ]
    const reordered = moveUnitToIndexInSameDay(base, emptyMap, 1, 'stop-b', 1)
    const persisted = normalizeActivitiesForPersist(reordered, emptyMap, 1)
    const day1 = persisted.filter((a) => a.day === 1)
    assert.deepEqual(
      day1.map((a) => a.id),
      ['stop-a', 'stop-b', 'meal-1', 'meal-2'],
    )
    assert.equal(day1[2].order + 1, day1[3].order)
    assert.equal(day1[2].isMealRecommendation, true)
    assert.equal(day1[3].isMealRecommendation, true)
  })
})

describe('slimActivitiesForRoutePreview', () => {
  it('mantém só campos de rota e remove galerias', () => {
    const acts = [fatActivity(1, 0), fatActivity(1, 1, 'meal')]
    const slim = slimActivitiesForRoutePreview(acts)
    assert.equal(slim.length, 2)
    for (const a of slim) {
      assert.ok(a.id)
      assert.ok(a.title || a.name)
      assert.equal(a.image_url, undefined)
      assert.equal(a.image_urls, undefined)
      assert.equal(a.description, undefined)
      assert.equal(a.reasoning, undefined)
      assert.ok(a.coordinates)
    }
    assert.equal(slim[1].isMealRecommendation, true)
  })
})
