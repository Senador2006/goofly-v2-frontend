import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveInsertionIndex,
  resolveTargetIndex,
  resolveInsertLineTop,
  isInsertionNoOp,
  shouldShowInsertLine,
  isDropInsideListZone,
  buildGhostRect,
  rectsIntersect,
  ghostIntersectsList,
  isGhostFullyOutsideList,
  ROTEIRO_DRAG_COMPACT_HEIGHT_PX,
  resolveExpandImageOffsetPx,
  scrollCompactCardBeforeExpand,
  ROTEIRO_DRAG_EXPAND_IMAGE_H_PX,
  ROTEIRO_DRAG_EXPAND_IMAGE_H_SM_PX,
} from '../src/utils/roteiroDragReorder.js'
import {
  moveActivityToIndexInSameDay,
  getActivityDayNumber,
  sortDayActivities,
} from '../src/utils/itineraryDayHelpers.js'

const emptyMap = new Map()

function dayOrderTitles(activities, dayNum) {
  return sortDayActivities(
    activities.filter((a) => getActivityDayNumber(a, emptyMap) === dayNum),
  ).map((a) => a.title)
}

describe('resolveInsertionIndex', () => {
  const slots = [
    { top: 100, bottom: 172, height: 72 },
    { top: 180, bottom: 252, height: 72 },
    { top: 260, bottom: 332, height: 72 },
  ]

  it('retorna 0 acima do centro do primeiro item', () => {
    assert.equal(resolveInsertionIndex(120, slots), 0)
  })

  it('retorna 1 entre o primeiro e o segundo', () => {
    assert.equal(resolveInsertionIndex(178, slots), 1)
  })

  it('retorna length abaixo do último item', () => {
    assert.equal(resolveInsertionIndex(400, slots), 3)
  })

  it('retorna 0 para lista vazia', () => {
    assert.equal(resolveInsertionIndex(100, []), 0)
  })
})

describe('resolveTargetIndex', () => {
  it('ajusta quando inserção é após a origem', () => {
    assert.equal(resolveTargetIndex(1, 3), 2)
  })

  it('mantém quando inserção é antes da origem', () => {
    assert.equal(resolveTargetIndex(3, 0), 0)
  })
})

describe('isInsertionNoOp', () => {
  it('detecta posição 0/1 para o primeiro card como no-op', () => {
    assert.equal(isInsertionNoOp(0, 0), true)
    assert.equal(isInsertionNoOp(0, 1), true)
    assert.equal(isInsertionNoOp(0, 2), false)
  })

  it('detecta posição final para o último card como no-op', () => {
    assert.equal(isInsertionNoOp(2, 3), true)
    assert.equal(isInsertionNoOp(2, 2), true)
    assert.equal(isInsertionNoOp(2, 1), false)
  })
})

describe('shouldShowInsertLine', () => {
  it('oculta linha em inserções que não mudam a ordem', () => {
    assert.equal(shouldShowInsertLine(0, 0), false)
    assert.equal(shouldShowInsertLine(1, 2), false)
    assert.equal(shouldShowInsertLine(0, 2), true)
  })
})

describe('isDropInsideListZone', () => {
  const listRect = { left: 100, right: 400, top: 200, bottom: 800 }

  it('aceita pointer dentro da lista', () => {
    assert.equal(isDropInsideListZone(250, 400, listRect), true)
  })

  it('rejeita pointer muito à direita', () => {
    assert.equal(isDropInsideListZone(500, 400, listRect), false)
  })

  it('aceita pointer levemente fora com margem', () => {
    assert.equal(isDropInsideListZone(420, 400, listRect), true)
  })
})

describe('buildGhostRect', () => {
  it('monta retângulo com altura compacta padrão', () => {
    const rect = buildGhostRect(100, 200, 280)
    assert.equal(rect.left, 100)
    assert.equal(rect.top, 200)
    assert.equal(rect.width, 280)
    assert.equal(rect.height, ROTEIRO_DRAG_COMPACT_HEIGHT_PX)
    assert.equal(rect.right, 380)
    assert.equal(rect.bottom, 200 + ROTEIRO_DRAG_COMPACT_HEIGHT_PX)
  })
})

describe('resolveExpandImageOffsetPx', () => {
  it('retorna 0 sem imagem', () => {
    assert.equal(resolveExpandImageOffsetPx({}), 0)
  })

  it('retorna altura da capa quando há image_url', () => {
    assert.equal(resolveExpandImageOffsetPx({ image_url: 'x.jpg' }), ROTEIRO_DRAG_EXPAND_IMAGE_H_PX)
    assert.equal(
      resolveExpandImageOffsetPx({ image_url: 'x.jpg' }, true),
      ROTEIRO_DRAG_EXPAND_IMAGE_H_SM_PX,
    )
  })
})

describe('scrollCompactCardBeforeExpand', () => {
  it('compensa capa futura no delta de scroll', () => {
    const scrollEl = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 200 }),
    }
    const cardEl = {
      getBoundingClientRect: () => ({ top: 320 }),
    }
    scrollCompactCardBeforeExpand(scrollEl, cardEl, 48, 144)
    assert.equal(scrollEl.scrollTop, 316)
  })
})

describe('ghostIntersectsList', () => {
  const listRect = { left: 100, top: 200, right: 400, bottom: 800 }

  it('detecta interseção parcial do ghost com a lista', () => {
    const ghost = buildGhostRect(350, 250, 120)
    assert.equal(ghostIntersectsList(ghost, listRect), true)
  })

  it('detecta ghost totalmente à direita da lista', () => {
    const ghost = buildGhostRect(420, 250, 120)
    assert.equal(ghostIntersectsList(ghost, listRect), false)
    assert.equal(isGhostFullyOutsideList(ghost, listRect), true)
  })

  it('detecta ghost totalmente acima da lista', () => {
    const ghost = buildGhostRect(150, 50, 200)
    assert.equal(isGhostFullyOutsideList(ghost, listRect), true)
  })

  it('detecta ghost encostando na borda como interseção', () => {
    const ghost = buildGhostRect(400, 250, 80)
    assert.equal(rectsIntersect(ghost, listRect), false)
    const touching = buildGhostRect(320, 250, 80)
    assert.equal(ghostIntersectsList(touching, listRect), true)
  })
})

describe('resolveInsertLineTop', () => {
  const listRect = { top: 50, bottom: 400 }
  const slots = [
    { top: 100, bottom: 172, height: 72 },
    { top: 180, bottom: 252, height: 72 },
  ]

  it('posiciona no topo do primeiro slot', () => {
    assert.equal(resolveInsertLineTop(0, slots, listRect), 50)
  })

  it('posiciona no meio do gap entre slots', () => {
    assert.equal(resolveInsertLineTop(1, slots, listRect), 126)
  })
})

describe('moveActivityToIndexInSameDay', () => {
  const base = [
    { id: 'a', title: 'Primeira', day: 1, order: 0, startTime: '09:00' },
    { id: 'b', title: 'Segunda', day: 1, order: 1, startTime: '11:00' },
    { id: 'c', title: 'Terceira', day: 1, order: 2, startTime: '14:00' },
    { id: 'd', title: 'Outro dia', day: 2, order: 0, startTime: '10:00' },
  ]

  it('move do início para o fim', () => {
    const next = moveActivityToIndexInSameDay(base, emptyMap, 1, 'a', 2)
    assert.deepEqual(dayOrderTitles(next, 1), ['Segunda', 'Terceira', 'Primeira'])
  })

  it('move do fim para o início', () => {
    const next = moveActivityToIndexInSameDay(base, emptyMap, 1, 'c', 0)
    assert.deepEqual(dayOrderTitles(next, 1), ['Terceira', 'Primeira', 'Segunda'])
  })

  it('retorna o array original quando índice é igual', () => {
    assert.equal(moveActivityToIndexInSameDay(base, emptyMap, 1, 'b', 1), base)
  })

  it('não altera atividades de outros dias', () => {
    const next = moveActivityToIndexInSameDay(base, emptyMap, 1, 'a', 2)
    assert.deepEqual(next.find((a) => a.id === 'd'), base.find((a) => a.id === 'd'))
  })
})
