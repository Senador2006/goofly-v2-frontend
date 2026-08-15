import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAdvancedMatching,
  isMetaPixelAdminPath,
  resolveMetaPurchaseEventId,
  trackMetaEvent,
  trackMetaPageView,
} from '../src/utils/metaPixel.js'

describe('metaPixel helpers', () => {
  it('isMetaPixelAdminPath cobre /admin e subrotas', () => {
    assert.equal(isMetaPixelAdminPath('/admin'), true)
    assert.equal(isMetaPixelAdminPath('/admin/users'), true)
    assert.equal(isMetaPixelAdminPath('/pagamento'), false)
    assert.equal(isMetaPixelAdminPath('/'), false)
  })

  it('buildAdvancedMatching extrai email, nome e id', () => {
    assert.equal(buildAdvancedMatching(null), undefined)
    assert.deepEqual(
      buildAdvancedMatching({
        id: 'u-1',
        email: '  Ada@Goofly.com  ',
        name: 'Ada Lovelace',
      }),
      {
        em: 'ada@goofly.com',
        fn: 'Ada',
        ln: 'Lovelace',
        external_id: 'u-1',
      }
    )
  })

  it('resolveMetaPurchaseEventId usa paymentId do Mercado Pago', () => {
    assert.equal(resolveMetaPurchaseEventId({ paymentId: 99, status: 'approved' }), '99')
    assert.equal(resolveMetaPurchaseEventId({ data: { paymentId: 'mp-1' } }), 'mp-1')
    assert.equal(resolveMetaPurchaseEventId({}), undefined)
  })
})

describe('metaPixel fbq calls', () => {
  beforeEach(() => {
    globalThis.window = { fbq: undefined }
  })

  it('trackMetaEvent e PageView são no-op sem fbq', () => {
    trackMetaEvent('Lead', { value: 1 })
    trackMetaPageView()
  })

  it('trackMetaEvent envia eventID para deduplicação', () => {
    const calls = []
    globalThis.window.fbq = function mockFbq() {
      calls.push([...arguments])
    }

    trackMetaEvent('Purchase', { value: 49.9, currency: 'BRL' }, 'pay-1')
    assert.deepEqual(calls[0], [
      'track',
      'Purchase',
      { value: 49.9, currency: 'BRL' },
      { eventID: 'pay-1' },
    ])
  })
})
