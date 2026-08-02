import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTdvLikePlaceData } from '../src/utils/tdvLikePlaceData.js'
import {
  getRealPlaceImageUrls,
  shouldShowTdvRoteiroGallery,
} from '../src/utils/placeImages.js'

test('F1 — getRealPlaceImageUrls lê image_urls / image_url da activity', () => {
  assert.deepEqual(
    getRealPlaceImageUrls({
      image_urls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
    }),
    ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg']
  )
  assert.deepEqual(getRealPlaceImageUrls({ image_url: 'https://cdn.example.com/c.jpg' }), [
    'https://cdn.example.com/c.jpg',
  ])
  assert.deepEqual(getRealPlaceImageUrls({ name: 'Sem foto' }), [])
})

test('F2 — buildTdvLikePlaceData inclui image_url/image_urls do card', () => {
  const payload = buildTdvLikePlaceData({
    name: 'Castelo',
    description: 'Histórico',
    location: 'Lisboa, Portugal',
    coordinates: { latitude: 38.71, longitude: -9.13 },
    image_urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
  })
  assert.equal(payload.name, 'Castelo')
  assert.equal(payload.image_url, 'https://cdn.example.com/a.jpg')
  assert.deepEqual(payload.image_urls, [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg',
  ])
  assert.deepEqual(payload.coordinates, { latitude: 38.71, longitude: -9.13 })
})

test('F2b — buildTdvLikePlaceData omite imagens quando só há placeholder implícito', () => {
  const payload = buildTdvLikePlaceData({
    name: 'Sem foto',
    description: 'X',
  })
  assert.equal('image_url' in payload, false)
  assert.equal('image_urls' in payload, false)
})

test('F3 — shouldShowTdvRoteiroGallery só para tdv_like com URLs e acesso completo', () => {
  const tdvAct = {
    source: 'tdv_like',
    image_urls: ['https://cdn.example.com/a.jpg'],
  }
  assert.equal(shouldShowTdvRoteiroGallery(tdvAct, true), true)
  assert.equal(shouldShowTdvRoteiroGallery(tdvAct, false), false)
  assert.equal(shouldShowTdvRoteiroGallery(tdvAct), false)
  assert.equal(
    shouldShowTdvRoteiroGallery(
      {
        source: 'ai_suggested',
        image_url: 'https://cdn.example.com/a.jpg',
      },
      true
    ),
    false
  )
  assert.equal(shouldShowTdvRoteiroGallery({ source: 'tdv_like' }, true), false)
})

test('F4 — hero topo omitido para tdv_like; galeria só com acesso completo', () => {
  const act = {
    source: 'tdv_like',
    image_url: 'https://cdn.example.com/a.jpg',
    image_urls: ['https://cdn.example.com/a.jpg'],
  }
  const showTdvGalleryPaid = shouldShowTdvRoteiroGallery(act, true)
  const showTdvGalleryFree = shouldShowTdvRoteiroGallery(act, false)
  const showTopHero = String(act.source).trim() !== 'tdv_like' && !!act.image_url
  assert.equal(showTdvGalleryPaid, true)
  assert.equal(showTdvGalleryFree, false)
  assert.equal(showTopHero, false)
})
