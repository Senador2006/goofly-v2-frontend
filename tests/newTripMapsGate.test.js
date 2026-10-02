import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

test('B15: NewTrip faz probe Maps no boot e exige coords', () => {
  const newTrip = readSrc('src/pages/NewTrip.jsx')
  const probe = readSrc('src/hooks/useGoogleMapsProbe.js')
  const wizard = readSrc('src/hooks/useNewTripWizard.js')
  const alerts = readSrc('src/components/planning/newTrip/NewTripFormAlerts.jsx')
  const destinations = readSrc('src/components/planning/newTrip/NewTripStepDestinations.jsx')
  const loader = readSrc('src/services/googleMapsPlacesLoader.js')
  const step1 = readSrc('src/utils/newTripStep1Validation.js')

  assert.match(loader, /probeGoogleMapsPlaces/)
  assert.match(probe, /probeGoogleMapsPlaces/)
  assert.match(newTrip, /useGoogleMapsProbe/)
  assert.match(wizard, /requirePlaceSelection:\s*true/)
  assert.match(wizard, /mapsUnavailable/)
  assert.match(alerts, /Google Maps indisponível/)
  assert.match(step1, /maps_unavailable/)
  assert.match(step1, /requirePlaceSelection = true/)
  assert.match(destinations, /Autocomplete indisponível/)
  assert.match(destinations, /disabled\s*\n\s*readOnly/)
})
