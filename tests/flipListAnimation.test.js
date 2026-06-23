import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  captureFlipPositions,
  captureReorderSnapshot,
  contentOffsetTop,
  lerpScrollFollowSwapCard,
  playReorderSwapAnimation,
  prefersReducedFlipMotion,
  scrollDeltaToShowCardBottom,
  scrollDeltaToShowCardTop,
  scrollToAlignCardTopAfterMoveDown,
  computeAlignCardTopDelta,
} from '../src/utils/flipListAnimation.js'

describe('flipListAnimation', () => {
  it('captureFlipPositions retorna mapa vazio para entrada inválida', () => {
    assert.equal(captureFlipPositions(null).size, 0)
    assert.equal(captureFlipPositions(undefined).size, 0)
  })

  it('captureFlipPositions ignora elementos sem getBoundingClientRect', () => {
    const map = new Map([['a', { foo: 1 }]])
    assert.equal(captureFlipPositions(map).size, 0)
  })

  it('captureReorderSnapshot inclui contentOffsets quando há scroll container', () => {
    const scrollEl = {
      scrollTop: 120,
      getBoundingClientRect: () => ({ top: 100 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 250 }),
    }
    const snapshot = captureReorderSnapshot(new Map([['a', cardEl]]), scrollEl)
    assert.equal(snapshot.contentOffsets.get('a'), 270)
    assert.equal(snapshot.scrollTop, 120)
  })

  it('contentOffsetTop combina scrollTop e retângulos', () => {
    const scrollEl = {
      scrollTop: 50,
      getBoundingClientRect: () => ({ top: 80 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 200 }),
    }
    assert.equal(contentOffsetTop(cardEl, scrollEl), 170)
  })

  it('scrollDeltaToShowCardTop detecta topo cortado', () => {
    const scrollEl = {
      getBoundingClientRect: () => ({ top: 100 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 80 }),
    }
    assert.equal(scrollDeltaToShowCardTop(scrollEl, cardEl), -60)
  })

  it('scrollDeltaToShowCardBottom detecta base cortada', () => {
    const scrollEl = {
      getBoundingClientRect: () => ({ top: 100, bottom: 500 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 400, bottom: 520 }),
    }
    assert.equal(scrollDeltaToShowCardBottom(scrollEl, cardEl), 60)
  })

  it('lerpScrollFollowSwapCard não rola para cima se o topo já está visível', () => {
    const scrollEl = {
      scrollTop: 200,
      getBoundingClientRect: () => ({ top: 100, bottom: 500 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 180, bottom: 400 }),
    }
    assert.equal(lerpScrollFollowSwapCard(scrollEl, cardEl, -1), 0)
    assert.equal(scrollEl.scrollTop, 200)
  })

  it('lerpScrollFollowSwapCard acompanha suavemente quando a base sai da tela ao descer', () => {
    const scrollEl = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 300, bottom: 430 }),
    }
    const applied = lerpScrollFollowSwapCard(scrollEl, cardEl, 1, 0.5)
    assert.equal(applied, 35)
    assert.equal(scrollEl.scrollTop, 135)
  })

  it('computeAlignCardTopDelta compensa transform FLIP para posição final', () => {
    const scrollEl = {
      getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 170, bottom: 300 }),
    }
    assert.equal(computeAlignCardTopDelta(scrollEl, cardEl, -130), 260)
  })

  it('scrollToAlignCardTopAfterMoveDown alinha topo do card que desceu', () => {
    const scrollEl = {
      scrollTop: 100,
      scrollTo({ top }) {
        this.scrollTop = top
      },
      getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 200, bottom: 350 }),
    }
    const delta = scrollToAlignCardTopAfterMoveDown(scrollEl, cardEl)
    assert.equal(delta, 160)
    assert.equal(scrollEl.scrollTop, 260)
  })

  it('playReorderSwapAnimation não lança com entradas inválidas', () => {
    assert.doesNotThrow(() => playReorderSwapAnimation(null, null, {}))
    assert.doesNotThrow(() =>
      playReorderSwapAnimation(new Map(), { positions: new Map() }, {}),
    )
    assert.doesNotThrow(() =>
      playReorderSwapAnimation(new Map(), { positions: new Map() }, { movedId: 'x' }),
    )
  })

  it('prefersReducedFlipMotion retorna booleano sem matchMedia', () => {
    assert.equal(typeof prefersReducedFlipMotion(), 'boolean')
  })
})
