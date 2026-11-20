import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('PasswordInput — mostrar/ocultar senha', () => {
  const src = read('src/components/auth/PasswordInput.jsx')

  it('alterna type entre password e text', () => {
    assert.match(src, /type=\{visible \? 'text' : 'password'\}/)
  })

  it('botão não submete o form e expõe estado acessível', () => {
    assert.match(src, /<button\s+type="button"/)
    assert.match(src, /aria-pressed=\{visible\}/)
    assert.match(src, /aria-controls=\{id\}/)
    assert.match(src, /Mostrar senha/)
    assert.match(src, /Ocultar senha/)
  })

  it('label ligado ao input', () => {
    assert.match(src, /<label htmlFor=\{id\}/)
  })

  it('desliga autocorreção/capitalização quando visível', () => {
    assert.match(src, /autoCapitalize="off"/)
    assert.match(src, /autoCorrect="off"/)
    assert.match(src, /spellCheck=\{false\}/)
  })

  it('volta a ocultar no submit do form', () => {
    assert.match(src, /form\.addEventListener\('submit', hide\)/)
    assert.match(src, /removeEventListener\('submit', hide\)/)
  })

  it('CSS esconde o reveal nativo do Edge', () => {
    assert.match(read('src/index.css'), /::-ms-reveal/)
  })
})

describe('Páginas de auth usam PasswordInput com autocomplete correto', () => {
  it('Login usa current-password e não tem input password cru', () => {
    const src = read('src/pages/Login.jsx')
    assert.match(src, /<PasswordInput/)
    assert.match(src, /autoComplete="current-password"/)
    assert.doesNotMatch(src, /type="password"/)
  })

  for (const page of ['src/pages/Register.jsx', 'src/pages/ResetPassword.jsx']) {
    it(`${page} tem senha + confirmação com new-password`, () => {
      const src = read(page)
      assert.equal((src.match(/<PasswordInput/g) || []).length, 2)
      assert.equal((src.match(/autoComplete="new-password"/g) || []).length, 2)
      assert.match(src, /setConfirmPassword/)
      assert.match(src, /validateNewPassword\(password, confirmPassword\)/)
      assert.match(src, /<PasswordRequirements/)
      assert.match(src, /<PasswordMatchHint/)
      assert.doesNotMatch(src, /onPaste/, 'colar deve continuar permitido')
    })
  }

  it('Register não envia confirmPassword para a API', () => {
    assert.match(read('src/pages/Register.jsx'), /register\(name, email, password, captchaToken\)/)
  })
})
