import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('UserAvatar — header e perfil', () => {
  it('componente UserAvatar existe com fallback de inicial', () => {
    assert.ok(existsSync(join(root, 'src/components/common/UserAvatar.jsx')))
    const source = read('src/components/common/UserAvatar.jsx')
    assert.match(source, /user\?\.avatar/)
    assert.match(source, /bg-primary/)
    assert.match(source, /Foto de perfil de/)
  })

  it('Header usa UserAvatar e não placeholder bg-gray-200 vazio', () => {
    const header = read('src/components/layout/Header.jsx')
    assert.match(header, /UserAvatar/)
    assert.match(header, /to="\/settings"/)
    assert.doesNotMatch(header, /bg-gray-200/)
  })

  it('DashboardHeader exibe UserAvatar com link para settings', () => {
    const header = read('src/components/layout/DashboardHeader.jsx')
    assert.match(header, /UserAvatar/)
    assert.match(header, /to="\/settings"/)
  })

  it('Settings não repete avatar grande no card Perfil', () => {
    const settings = read('src/pages/Settings.jsx')
    assert.doesNotMatch(settings, /size-20 rounded-full bg-primary/)
    assert.match(settings, /font-bold text-lg.*user\?\.name/)
  })

  it('Sidebar reutiliza UserAvatar', () => {
    const sidebar = read('src/components/layout/Sidebar.jsx')
    assert.match(sidebar, /UserAvatar/)
    assert.doesNotMatch(sidebar, /alt=""/)
  })
})
