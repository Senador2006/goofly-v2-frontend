import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

const sessionSource = readSrc('src/utils/docsAssistSession.js')
const docsView = readSrc('src/components/itinerary/DocumentosView.jsx')
const docService = readSrc('src/services/documentService.js')

test('C13 docsAssistSession: API de restore na aba', () => {
  assert.match(sessionSource, /readDocsAssistSession/)
  assert.match(sessionSource, /writeDocsAssistSession/)
  assert.match(sessionSource, /clearDocsAssistSession/)
  assert.match(sessionSource, /goofly:docs-assist:/)
})

test('C13 DocumentosView: não auto-fetch no mount; gera sob CTA', () => {
  assert.match(docsView, /Gerar com IA/)
  assert.match(docsView, /generateAssist/)
  assert.match(docsView, /readDocsAssistSession/)
  assert.match(docsView, /writeDocsAssistSession/)
  assert.match(docsView, /force:\s*true/)

  const effectStart = docsView.indexOf('useEffect(() => {')
  const effectEnd = docsView.indexOf('}, [tripId, hasPlanejamentoCompleto])')
  assert.ok(effectStart >= 0 && effectEnd > effectStart)
  const effectBody = docsView.slice(effectStart, effectEnd)
  assert.match(effectBody, /readDocsAssistSession/)
  assert.doesNotMatch(effectBody, /documentService/)
  assert.doesNotMatch(effectBody, /getChecklist|getLuggage/)
})

test('C13 documentService FE: propaga force no POST', () => {
  assert.match(docService, /force:\s*force === true/)
  assert.match(docService, /force = false/)
})
