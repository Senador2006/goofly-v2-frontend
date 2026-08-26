import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyOptimisticDislike,
  applyOptimisticLike,
  applyOptimisticUndo,
  getOptimisticPlaceId,
  rollbackOptimisticDislike,
  rollbackOptimisticLike,
  rollbackOptimisticUndo,
  shouldBlockSwipeGesture,
} from '../src/utils/tdvOptimisticSwipe.js'
import { likeEntryFromTdvPlace } from '../src/utils/tdvLikeEntry.js'

const placeA = { id: 'p-a', name: 'Castelo' }
const placeB = { id: 'p-b', name: 'Miradouro' }

test('getOptimisticPlaceId lê id/placeId', () => {
  assert.equal(getOptimisticPlaceId(placeA), 'p-a')
  assert.equal(getOptimisticPlaceId({ placeId: 'x' }), 'x')
  assert.equal(getOptimisticPlaceId({}), null)
})

test('optimistic like: deck/listas atualizam antes do API; estado final estável', () => {
  const likeEntry = likeEntryFromTdvPlace(placeA)
  const before = {
    places: [placeA, placeB],
    likedPlaces: [],
    undoStack: [],
    totalLikes: 0,
  }
  const after = applyOptimisticLike(before, placeA, 'p-a', likeEntry)
  assert.deepEqual(
    after.places.map((p) => p.id),
    ['p-b']
  )
  assert.equal(after.likedPlaces[0].placeId, 'p-a')
  assert.equal(after.undoStack.length, 1)
  assert.equal(after.undoStack[0].type, 'like')
  assert.equal(after.totalLikes, 1)
})

test('optimistic like rollback restaura estado pré-gesto', () => {
  const likeEntry = likeEntryFromTdvPlace(placeA)
  const optimistic = applyOptimisticLike(
    { places: [placeA, placeB], likedPlaces: [], undoStack: [], totalLikes: 2 },
    placeA,
    'p-a',
    likeEntry
  )
  const rolled = rollbackOptimisticLike(optimistic, placeA, 'p-a')
  assert.equal(rolled.places[0].id, 'p-a')
  assert.ok(rolled.places.some((p) => p.id === 'p-b'))
  assert.equal(rolled.likedPlaces.length, 0)
  assert.equal(rolled.undoStack.length, 0)
  assert.equal(rolled.totalLikes, 2)
})

test('optimistic dislike + rollback', () => {
  const optimistic = applyOptimisticDislike(
    { places: [placeA, placeB], dislikedPlaces: [], undoStack: [] },
    placeA,
    'p-a'
  )
  assert.equal(optimistic.places.length, 1)
  assert.equal(optimistic.dislikedPlaces[0].placeId, 'p-a')
  const rolled = rollbackOptimisticDislike(optimistic, placeA, 'p-a')
  assert.equal(rolled.places[0].id, 'p-a')
  assert.equal(rolled.dislikedPlaces.length, 0)
  assert.equal(rolled.undoStack.length, 0)
})

test('shouldBlockSwipeGesture impede double-tap', () => {
  assert.equal(shouldBlockSwipeGesture(false), false)
  assert.equal(shouldBlockSwipeGesture(true), true)
})

test('optimistic undo like recoloca carta e remove das curtidas', () => {
  const place = { id: 'p-a', name: 'Castelo' }
  const applied = applyOptimisticUndo(
    {
      places: [{ id: 'p-b', name: 'Miradouro' }],
      likedPlaces: [{ placeId: 'p-a', name: 'Castelo' }],
      dislikedPlaces: [],
      totalLikes: 2,
    },
    { type: 'like', place }
  )
  assert.equal(applied.places[0].id, 'p-a')
  assert.equal(applied.likedPlaces.length, 0)
  assert.equal(applied.totalLikes, 1)
})

test('optimistic undo rollback restaura like', () => {
  const place = { id: 'p-a', name: 'Castelo' }
  const entry = { type: 'like', place }
  const afterUndo = applyOptimisticUndo(
    {
      places: [{ id: 'p-b' }],
      likedPlaces: [{ placeId: 'p-a', name: 'Castelo' }],
      dislikedPlaces: [],
      undoStack: [],
      totalLikes: 1,
    },
    entry
  )
  const rolled = rollbackOptimisticUndo(afterUndo, entry, {
    placeId: 'p-a',
    name: 'Castelo',
  })
  assert.ok(!rolled.places.some((p) => p.id === 'p-a'))
  assert.equal(rolled.likedPlaces[0].placeId, 'p-a')
  assert.equal(rolled.undoStack.length, 1)
  assert.equal(rolled.totalLikes, 1)
})
