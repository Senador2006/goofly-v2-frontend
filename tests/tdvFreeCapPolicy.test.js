import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FREE_CAP_MAX_PLACES,
  isHardFreeCap,
  isPaidBatchCap,
  shouldLatchFreeCapPaywall,
  shouldRetryPrefetchOnEmpty,
} from '../src/utils/tdvFreeCapPolicy.js'

test('B14: isHardFreeCap exige free_cap + 10 swipes', () => {
  assert.equal(isHardFreeCap({ placesSource: 'agent' }, 10), false)
  assert.equal(isHardFreeCap({ placesSource: 'free_cap', tdvLimit: { placesSwiped: 9 } }), false)
  assert.equal(
    isHardFreeCap({ placesSource: 'free_cap', tdvLimit: { placesSwiped: FREE_CAP_MAX_PLACES } }),
    true
  )
})

test('B14: shouldLatchFreeCapPaywall não latcheia se unlocked', () => {
  assert.equal(
    shouldLatchFreeCapPaywall({
      placesSource: 'free_cap',
      tdvLimit: { unlocked: true, placesSwiped: 10 },
    }),
    false
  )
  assert.equal(
    shouldLatchFreeCapPaywall({ placesSource: 'free_cap', tdvLimit: { placesSwiped: 10 } }),
    true
  )
})

test('B14: shouldRetryPrefetchOnEmpty respeita teto de swipes', () => {
  assert.equal(
    shouldRetryPrefetchOnEmpty({ tdvLimit: { unlocked: false, placesSwiped: 10 } }),
    false
  )
  assert.equal(
    shouldRetryPrefetchOnEmpty({
      tdvLimit: {
        unlocked: false,
        placesSwiped: 3,
        batchesUsed: 0,
        freeMaxBatches: 2,
        freeRefillBatches: 1,
      },
    }),
    true
  )
})

test('C20: isPaidBatchCap e shouldRetryPrefetchOnEmpty respeitam teto pago', () => {
    assert.equal(
      isPaidBatchCap({
        placesSource: 'paid_batch_cap',
        tdvLimit: { unlocked: true, batchesUsed: 30, paidMaxBatches: 30 },
      }),
      true
    )
    assert.equal(
      isPaidBatchCap({
        tdvLimit: { unlocked: true, batchesUsed: 11, paidMaxBatches: 30 },
      }),
      false
    )
    assert.equal(
      shouldRetryPrefetchOnEmpty({
        tdvLimit: { unlocked: true, batchesUsed: 30, paidMaxBatches: 30, batchCapReached: true },
      }),
      false
    )
    assert.equal(
      shouldRetryPrefetchOnEmpty({
        tdvLimit: { unlocked: true, batchesUsed: 2, paidMaxBatches: 30 },
      }),
      true
    )
})
