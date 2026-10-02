import test from 'node:test'
import assert from 'node:assert/strict'
import { safeImageUrl } from '../src/utils/safeImageUrl.js'

test('aceita http(s) absolutas', () => {
  assert.equal(safeImageUrl('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg')
  assert.equal(safeImageUrl('http://cdn.example.com/a.jpg'), 'http://cdn.example.com/a.jpg')
})

test('rejeita javascript: e data:', () => {
  assert.equal(safeImageUrl('javascript:alert(1)'), null)
  assert.equal(safeImageUrl('data:image/png;base64,abc'), null)
})

test('rejeita vazio / não-string', () => {
  assert.equal(safeImageUrl(''), null)
  assert.equal(safeImageUrl('   '), null)
  assert.equal(safeImageUrl(null), null)
  assert.equal(safeImageUrl(undefined), null)
})

test('normaliza aspas que quebrariam CSS url()', () => {
  const src = safeImageUrl('https://evil.example/x");background:url(//x')
  assert.ok(src)
  assert.equal(src.includes('"'), false)
  assert.match(src, /^https:\/\/evil\.example\//)
})

test('resolve relativa contra base', () => {
  assert.equal(
    safeImageUrl('/uploads/a.jpg', 'https://app.example'),
    'https://app.example/uploads/a.jpg'
  )
})
