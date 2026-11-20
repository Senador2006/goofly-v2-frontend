import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_WEAK_MESSAGE,
  evaluatePassword,
  isPasswordStrong,
  passwordsMatch,
  validateNewPassword,
} from '../src/utils/authPasswordValidation.js'

const okKeys = (p) => evaluatePassword(p).filter((r) => r.ok).map((r) => r.key)

describe('authPasswordValidation — regras de força (espelho do backend)', () => {
  it('senha vazia não atende nenhuma regra', () => {
    assert.deepEqual(okKeys(''), [])
  })

  it('avalia cada regra isoladamente', () => {
    assert.deepEqual(okKeys('abcdefgh'), ['length'])
    assert.deepEqual(okKeys('A'), ['upper'])
    assert.deepEqual(okKeys('1'), ['digit'])
    assert.deepEqual(okKeys('!'), ['symbol'])
  })

  it('espaço conta como símbolo (igual a [^A-Za-z0-9] no backend)', () => {
    assert.ok(okKeys(' ').includes('symbol'))
  })

  it('isPasswordStrong exige todas as regras', () => {
    assert.equal(isPasswordStrong('Senha123!'), true)
    assert.equal(isPasswordStrong('senha123!'), false)
    assert.equal(isPasswordStrong('Senha!!!!'), false)
    assert.equal(isPasswordStrong('Senha1234'), false)
    assert.equal(isPasswordStrong('Se1!'), false)
  })

  it('tolera entrada não-string', () => {
    assert.equal(isPasswordStrong(undefined), false)
    assert.equal(evaluatePassword(null).length, 4)
  })

  it('casa com a regex do services', () => {
    const backend = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
    for (const p of ['Senha123!', 'abc', 'ABCDEFG1!', 'Áéí1234!', 'Pass word1', 'P@ssw0rd', '12345678']) {
      assert.equal(isPasswordStrong(p), backend.test(p), p)
    }
  })
})

describe('authPasswordValidation — confirmação', () => {
  it('passwordsMatch é comparação exata', () => {
    assert.equal(passwordsMatch('Senha123!', 'Senha123!'), true)
    assert.equal(passwordsMatch('Senha123!', 'senha123!'), false)
    assert.equal(passwordsMatch('Senha123!', 'Senha123! '), false)
  })

  it('duas senhas vazias não contam como coincidentes', () => {
    assert.equal(passwordsMatch('', ''), false)
  })

  it('validateNewPassword prioriza força, depois confirmação', () => {
    assert.equal(validateNewPassword('fraca', 'fraca'), PASSWORD_WEAK_MESSAGE)
    assert.equal(validateNewPassword('Senha123!', 'Senha123?'), PASSWORD_MISMATCH_MESSAGE)
    assert.equal(validateNewPassword('Senha123!', 'Senha123!'), '')
  })
})
