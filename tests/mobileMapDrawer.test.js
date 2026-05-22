import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveMobileMapSnap,
  computeMapTranslate,
  computeHandleInset,
  resolveHandleWidthPx,
  mobileMapDrawerTransitionStyle,
  MOBILE_MAP_HANDLE_PX,
  MOBILE_MAP_HANDLE_COMPACT_PX,
  MOBILE_MAP_DRAWER_MS,
} from '../src/utils/mobileMapDrawer.js'

const THRESHOLD = 100

describe('resolveMobileMapSnap', () => {
  it('abre ao arrastar para a esquerda (dx negativo)', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: false, dragDx: -120, thresholdPx: THRESHOLD }), true)
  })

  it('não abre com arrasto esquerdo fraco', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: false, dragDx: -20, thresholdPx: THRESHOLD }), false)
  })

  it('fecha ao arrastar para a direita com mapa aberto', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: true, dragDx: 80, thresholdPx: THRESHOLD }), false)
  })

  it('mantém aberto com arrasto direito fraco', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: true, dragDx: 20, thresholdPx: THRESHOLD }), true)
  })

  it('toggle no tap com mapa fechado', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: false, dragDx: 0, thresholdPx: THRESHOLD }), true)
  })

  it('toggle no tap com mapa aberto', () => {
    assert.equal(resolveMobileMapSnap({ wasOpen: true, dragDx: 2, thresholdPx: THRESHOLD }), false)
  })
})

describe('computeMapTranslate', () => {
  it('escondido à direita quando fechado', () => {
    assert.equal(computeMapTranslate({ open: false, isDragging: false, dragOffset: 0 }), 'translateX(100%)')
  })

  it('visível quando aberto', () => {
    assert.equal(computeMapTranslate({ open: true, isDragging: false, dragOffset: 0 }), 'translateX(0)')
  })

  it('segue arrasto ao abrir (da direita)', () => {
    assert.match(
      computeMapTranslate({ open: false, isDragging: true, dragOffset: -40 }),
      /calc\(100% \+ -40px\)/
    )
  })
})

describe('mobileMapDrawerTransitionStyle', () => {
  it('usa duração mais longa e easing suave', () => {
    const style = mobileMapDrawerTransitionStyle()
    assert.match(style, new RegExp(`transform ${MOBILE_MAP_DRAWER_MS}ms`))
    assert.match(style, /cubic-bezier\(0\.25, 0\.46, 0\.45, 0\.94\)/)
  })
})

describe('computeHandleInset', () => {
  it('handle na borda direita quando fechado', () => {
    assert.deepEqual(computeHandleInset({ open: false, isDragging: false, dragOffset: 0 }), { right: 0 })
  })

  it('handle na borda esquerda quando aberto (fechar)', () => {
    assert.deepEqual(computeHandleInset({ open: true, isDragging: false, dragOffset: 0 }), { left: 0 })
  })

  it('handle acompanha arrasto ao abrir', () => {
    assert.deepEqual(computeHandleInset({ open: false, isDragging: true, dragOffset: -40 }), { right: 40 })
  })

  it('aberto encostado na borda esquerda (left: 0)', () => {
    assert.deepEqual(computeHandleInset({ open: true, isDragging: false, dragOffset: 0 }), { left: 0 })
  })
})

describe('resolveHandleWidthPx', () => {
  it('largura total fechado ou arrastando', () => {
    assert.equal(resolveHandleWidthPx({ open: false, isDragging: false }), MOBILE_MAP_HANDLE_PX)
    assert.equal(resolveHandleWidthPx({ open: true, isDragging: true }), MOBILE_MAP_HANDLE_PX)
  })

  it('botão compacto com mapa aberto e parado', () => {
    assert.equal(resolveHandleWidthPx({ open: true, isDragging: false }), MOBILE_MAP_HANDLE_COMPACT_PX)
  })
})
