/**
 * Meta Pixel (fbq) — wrapper para SPA.
 *
 * O base code em index.html faz init + PageView do primeiro load.
 * Daí em diante: PageView em cada rota e eventos de conversão (cadastro,
 * lead, checkout, purchase). No-op se o Pixel não estiver configurado
 * ou o script estiver bloqueado.
 */

export const META_PIXEL_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js'

function getWindow() {
  return typeof globalThis !== 'undefined' ? globalThis.window : undefined
}

function getDocument() {
  return typeof globalThis !== 'undefined' ? globalThis.document : undefined
}

export function getMetaPixelId() {
  const win = getWindow()
  if (win?.__META_PIXEL_ID__) {
    const fromWindow = String(win.__META_PIXEL_ID__).trim()
    if (fromWindow && !fromWindow.includes('%VITE_')) return fromWindow
  }

  try {
    return String(import.meta.env?.VITE_META_PIXEL_ID || '').trim()
  } catch {
    return ''
  }
}

export function isMetaPixelAdminPath(pathname = '') {
  return String(pathname).startsWith('/admin')
}

export function buildAdvancedMatching(user) {
  if (!user || typeof user !== 'object') return undefined

  const em = String(user.email || '').trim().toLowerCase()
  const parts = String(user.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const fn = parts[0] || ''
  const ln = parts.slice(1).join(' ')
  const external_id = user.id != null && String(user.id).trim() ? String(user.id).trim() : ''

  const data = {}
  if (em) data.em = em
  if (fn) data.fn = fn
  if (ln) data.ln = ln
  if (external_id) data.external_id = external_id

  return Object.keys(data).length ? data : undefined
}

export function resolveMetaPurchaseEventId(paymentResult) {
  const id =
    paymentResult?.paymentId ??
    paymentResult?.data?.paymentId ??
    paymentResult?.id ??
    paymentResult?.data?.id
  return id != null && String(id).trim() ? String(id).trim() : undefined
}

function installFbqStub(win) {
  if (typeof win.fbq === 'function') return win.fbq

  const fbq = function fbqStub() {
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments)
  }
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  win.fbq = fbq
  if (!win._fbq) win._fbq = fbq
  return fbq
}

function appendPixelScript(doc) {
  if (!doc || typeof doc.createElement !== 'function') return
  if (doc.querySelector('script[data-meta-pixel="1"]')) return

  const script = doc.createElement('script')
  script.async = true
  script.src = META_PIXEL_SCRIPT_URL
  script.dataset.metaPixel = '1'
  const first = doc.getElementsByTagName('script')[0]
  if (first?.parentNode) {
    first.parentNode.insertBefore(script, first)
  } else {
    doc.head?.appendChild(script)
  }
}

/**
 * Garante fbq + init. Seguro chamar de novo após login (Advanced Matching).
 */
export function initMetaPixel(pixelId = getMetaPixelId(), userData) {
  const win = getWindow()
  if (!win) return false
  const id = String(pixelId || '').trim()
  if (!id || id.includes('%VITE_')) return false

  win.__META_PIXEL_ID__ = id
  const fbq = installFbqStub(win)
  appendPixelScript(getDocument())

  const matching = userData && typeof userData === 'object' ? userData : undefined
  if (matching && Object.keys(matching).length) {
    fbq('init', id, matching)
  } else {
    fbq('init', id)
  }
  return true
}

export function trackMetaPageView() {
  const win = getWindow()
  if (typeof win?.fbq !== 'function') return
  win.fbq('track', 'PageView')
}

export function trackMetaEvent(eventName, params = {}, eventId) {
  const win = getWindow()
  if (typeof win?.fbq !== 'function') return
  const name = String(eventName || '').trim()
  if (!name) return

  const payload = params && typeof params === 'object' ? params : {}
  if (eventId) {
    win.fbq('track', name, payload, { eventID: String(eventId) })
    return
  }
  win.fbq('track', name, payload)
}
