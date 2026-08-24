import test from 'node:test'
import assert from 'node:assert/strict'
import {
  likeEntryFromTdvPlace,
  mergeTdvLikeEntry,
  mergeTdvLikeListsById,
} from '../src/utils/tdvLikeEntry.js'

test('likeEntryFromTdvPlace inclui imagens do card TDV', () => {
  const entry = likeEntryFromTdvPlace({
    id: 'p-castelo',
    name: 'Castelo',
    description: 'Histórico',
    image_urls: ['https://cdn.example.com/a.jpg'],
  })
  assert.equal(entry.placeId, 'p-castelo')
  assert.equal(entry.image_url, 'https://cdn.example.com/a.jpg')
  assert.deepEqual(entry.image_urls, ['https://cdn.example.com/a.jpg'])
})

test('mergeTdvLikeEntry preserva imagens do servidor quando local é pobre', () => {
  const server = {
    placeId: 'p1',
    name: 'Torre',
    image_url: 'https://cdn.example.com/t.jpg',
    image_urls: ['https://cdn.example.com/t.jpg'],
  }
  const local = { placeId: 'p1', name: 'Torre' }
  const merged = mergeTdvLikeEntry(server, local)
  assert.equal(merged.image_url, 'https://cdn.example.com/t.jpg')
  assert.deepEqual(merged.image_urls, ['https://cdn.example.com/t.jpg'])
})

test('mergeTdvLikeEntry mantém imagens locais quando presentes', () => {
  const server = {
    placeId: 'p1',
    image_url: 'https://cdn.example.com/old.jpg',
  }
  const local = {
    placeId: 'p1',
    image_url: 'https://cdn.example.com/new.jpg',
    image_urls: ['https://cdn.example.com/new.jpg'],
  }
  const merged = mergeTdvLikeEntry(server, local)
  assert.equal(merged.image_url, 'https://cdn.example.com/new.jpg')
})

test('mergeTdvLikeListsById combina servidor + local sem perder imagens', () => {
  const serverList = [
    {
      placeId: 'p1',
      name: 'Torre',
      image_url: 'https://cdn.example.com/t.jpg',
      image_urls: ['https://cdn.example.com/t.jpg'],
    },
  ]
  const localList = [{ placeId: 'p1', name: 'Torre' }]
  const merged = mergeTdvLikeListsById(serverList, localList)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].image_url, 'https://cdn.example.com/t.jpg')
})
