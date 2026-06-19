import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const AUTH_PAGES = [
  'src/pages/Login.jsx',
  'src/pages/Register.jsx',
]

const REQUIRED_DARK_TOKENS = [
  'dark:bg-background-dark',
  'dark:bg-card-dark',
  'dark:border-border-dark',
]

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('U-01 — páginas de auth respeitam dark mode', () => {
  for (const page of AUTH_PAGES) {
    it(`${page} não usa bg-white fixo no container da página`, () => {
      const src = read(page)
      assert.doesNotMatch(
        src,
        /min-h-screen bg-white\b/,
        `${page} ainda tem min-h-screen bg-white (ignora dark mode)`
      )
    })

    it(`${page} usa AuthPageLayout`, () => {
      const src = read(page)
      assert.match(src, /AuthPageLayout/, `${page} deve usar AuthPageLayout`)
    })
  }

  it('AuthPageLayout centraliza tokens dark semânticos', () => {
    const src = read('src/components/auth/AuthPageLayout.jsx')
    for (const token of REQUIRED_DARK_TOKENS) {
      assert.match(src, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `AuthPageLayout falta ${token}`)
    }
    assert.match(src, /dark:text-red-400/, 'AuthPageLayout erro sem contraste dark')
    assert.match(src, /AUTH_INPUT_CLASS[\s\S]*dark:border-border-dark/, 'inputs sem borda dark')
  })

  it('Login e Register mantêm fluxo de navegação intacto', () => {
    assert.match(read('src/pages/Login.jsx'), /navigate\(['"]\/dashboard['"]\)/)
    assert.match(read('src/pages/Register.jsx'), /navigate\(['"]\/dashboard['"]\)/)
    assert.match(read('src/pages/Login.jsx'), /to="\/register"/)
    assert.match(read('src/pages/Register.jsx'), /to="\/login"/)
  })

  it('Register mantém TurnstileWidget', () => {
    assert.match(read('src/pages/Register.jsx'), /TurnstileWidget/)
  })
})
