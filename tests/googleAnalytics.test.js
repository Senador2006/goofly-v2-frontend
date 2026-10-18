import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isGaAdminPath,
  trackGaEvent,
  trackGaPageView,
} from '../src/utils/googleAnalytics.js'

describe('googleAnalytics helpers', () => {
  it('isGaAdminPath cobre /admin e subrotas', () => {
    assert.equal(isGaAdminPath('/admin'), true)
    assert.equal(isGaAdminPath('/admin/users'), true)
    assert.equal(isGaAdminPath('/pagamento'), false)
    assert.equal(isGaAdminPath('/'), false)
  })
})

describe('googleAnalytics gtag calls', () => {
  beforeEach(() => {
    globalThis.window = { gtag: undefined, location: { href: 'https://www.goofly.com.br/viagens' } }
    globalThis.document = { title: 'Goofly' }
  })

  it('trackGaEvent e page_view são no-op sem gtag', () => {
    trackGaEvent('sign_up', { method: 'email' })
    trackGaPageView('/viagens')
  })

  it('trackGaPageView envia page_path, page_location e page_title', () => {
    const calls = []
    globalThis.window.gtag = function mockGtag() {
      calls.push([...arguments])
    }

    trackGaPageView('/viagens', '?tab=1')
    assert.deepEqual(calls[0], [
      'event',
      'page_view',
      {
        page_path: '/viagens?tab=1',
        page_location: 'https://www.goofly.com.br/viagens',
        page_title: 'Goofly',
      },
    ])
  })

  it('trackGaEvent envia nome e params', () => {
    const calls = []
    globalThis.window.gtag = function mockGtag() {
      calls.push([...arguments])
    }

    trackGaEvent('purchase', { value: 49.9, currency: 'BRL' })
    assert.deepEqual(calls[0], ['event', 'purchase', { value: 49.9, currency: 'BRL' }])
  })
})
