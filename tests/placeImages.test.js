import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPlaceImageUrls,
  getPlaceCoverImageUrl,
  getPlaceVideoUrls,
  resolveVideoPresentation,
} from '../src/utils/placeImages.js'

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

test('getPlaceImageUrls aceita imageLinks (payload do agente)', () => {
  const urls = getPlaceImageUrls({
    imageLinks: ['https://a.com/1.jpg'],
  })
  assert.deepEqual(urls, ['https://a.com/1.jpg'])
})

test('getPlaceVideoUrls lê videoLinks', () => {
  const urls = getPlaceVideoUrls({
    videoLinks: ['https://www.instagram.com/reel/DV28jrACA0x/', 'https://youtu.be/abc123xyz'],
  })
  assert.equal(urls.length, 2)
  assert.match(urls[0], /instagram\.com/)
})

test('resolveVideoPresentation: Instagram reel vira embed', () => {
  const p = resolveVideoPresentation('https://www.instagram.com/reel/DV28jrACA0x/')
  assert.equal(p.mode, 'iframe')
  assert.match(p.src, /instagram\.com\/reel\/DV28jrACA0x\/embed\//)
})

test('resolveVideoPresentation: mp4 direto', () => {
  const p = resolveVideoPresentation('https://cdn.example.com/clip.mp4')
  assert.equal(p.mode, 'video')
  assert.equal(p.src, 'https://cdn.example.com/clip.mp4')
})
