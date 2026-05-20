import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const GUARDED_FILES = [
  'src/pages/Itinerary.jsx',
  'src/components/itinerary/ItineraryMobileMapDrawer.jsx',
]

describe('jsxBalance', () => {
  for (const rel of GUARDED_FILES) {
    it(`${rel} sem motion.div (regressão ErrorBoundary)`, () => {
      const source = readFileSync(join(base, rel), 'utf8')
      assert.doesNotMatch(source, /<\/?motion\.div\b/, `${rel} contém motion.div`)
    })
  }
})
