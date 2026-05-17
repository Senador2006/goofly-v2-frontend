import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlaceImageUrls, getPlaceCoverImageUrl } from '../src/utils/placeImages.js'

test('getPlaceImageUrls usa image_urls da API', () => {
  const urls = getPlaceImageUrls({
    image_urls: ['https://a.com/1.jpg', 'https://b.com/2.jpg'],
  })
  assert.deepEqual(urls, ['https://a.com/1.jpg', 'https://b.com/2.jpg'])
})

test('getPlaceImageUrls faz fallback para image_url única', () => {
  const urls = getPlaceImageUrls({ image_url: 'https://a.com/cover.jpg' })
  assert.deepEqual(urls, ['https://a.com/cover.jpg'])
})

test('getPlaceCoverImageUrl retorna primeira URL', () => {
  assert.equal(
    getPlaceCoverImageUrl({ image_urls: ['https://a.com/1.jpg', 'https://b.com/2.jpg'] }),
    'https://a.com/1.jpg'
  )
})
