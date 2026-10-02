import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

test('B14: NewTrip é um shell fino dos hooks e componentes extraídos', () => {
  const source = readSrc('src/pages/NewTrip.jsx')
  assert.ok(source.split(/\r?\n/).length < 500)
  assert.match(source, /useGoogleMapsProbe/)
  assert.match(source, /useNewTripWizard/)
  assert.match(source, /useCreateTrip/)
  assert.match(source, /NewTripStepDestinations/)
  assert.match(source, /NewTripStepStay/)
  assert.match(source, /NewTripStepInterests/)
  assert.match(source, /NewTripStepPreferences/)
  assert.match(source, /NewTripWizardNav/)
})

test('B14: useCreateTrip preserva idempotência e cancelamento', () => {
  const source = readSrc('src/hooks/useCreateTrip.js')
  assert.match(source, /Idempotency-Key/)
  assert.match(source, /AbortController/)
  assert.match(source, /createInFlightRef/)
})
