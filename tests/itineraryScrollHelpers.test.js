import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  scrollElementToContainerTop,
  scrollElementToContainerTopAfterLayout,
} from '../src/utils/itineraryScrollHelpers.js'

describe('itineraryScrollHelpers', () => {
  it('scrollElementToContainerTop ajusta scrollTop do container', () => {
    const element = {
      getBoundingClientRect: () => ({ top: 180 }),
    }
    let scrolledTo = null
    const container = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 40 }),
      scrollTo(options) {
        scrolledTo = options
      },
    }

    scrollElementToContainerTop(element, container, 10)

    assert.deepEqual(scrolledTo, { top: 230, behavior: 'smooth' })
  })

  it('scrollElementToContainerTop ignora delta pequeno', () => {
    let called = false
    const element = {
      getBoundingClientRect: () => ({ top: 50 }),
    }
    const container = {
      scrollTop: 0,
      getBoundingClientRect: () => ({ top: 42 }),
      scrollTo() {
        called = true
      },
    }

    scrollElementToContainerTop(element, container, 8)
    assert.equal(called, false)
  })

  it('scrollElementToContainerTopAfterLayout é exportado', () => {
    assert.equal(typeof scrollElementToContainerTopAfterLayout, 'function')
  })
})
