import { PLACEHOLDER_COVER } from '../constants/placeholders.js'

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/**
 * URLs http(s) reais do place/activity — sem placeholder.
 * Usado no like TDV e na galeria compacta do roteiro.
 */
export function getRealPlaceImageUrls(place) {
  if (!place) return []

  const fromApi = place.image_urls ?? place.imageUrls ?? place.imageLinks ?? place.image_links
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    const valid = fromApi.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(isHttpUrl)
    if (valid.length > 0) return valid
  }

  const single = place.image_url ?? place.imageUrl
  if (isHttpUrl(single)) return [single.trim()]

  return []
}

/**
 * Galeria compacta no roteiro: só na versão completa (paga) e para paradas
 * curtidas no TDV com imagens reais.
 *
 * @param {Record<string, unknown> | null | undefined} act
 * @param {boolean} [hasFullAccess=false]
 */
export function shouldShowTdvRoteiroGallery(act, hasFullAccess = false) {
  if (!hasFullAccess) return false
  return String(act?.source || '').trim() === 'tdv_like' && getRealPlaceImageUrls(act).length > 0
}

/**
 * URLs de vídeo vindas do agente TDV (`videoLinks`) ou snake_case da API.
 */
export function getPlaceVideoUrls(place) {
  if (!place) return []
  const raw = place.videoLinks ?? place.video_links
  if (!Array.isArray(raw)) return []
  return raw.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(isHttpUrl)
}

/**
 * Como exibir um link de vídeo no carrossel: iframe (redes), tag video (mp4/webm) ou abrir em nova aba.
 * @returns {{ mode: 'iframe', src: string } | { mode: 'video', src: string } | { mode: 'link', href: string }}
 */
export function resolveVideoPresentation(pageUrl) {
  const u = typeof pageUrl === 'string' ? pageUrl.trim() : ''
  if (!isHttpUrl(u)) return { mode: 'link', href: u || '#' }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { mode: 'video', src: u }

  let m = u.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([^&\s?#/]+)/i)
  if (m) return { mode: 'iframe', src: `https://www.youtube.com/embed/${m[1]}` }

  m = u.match(/instagram\.com\/(?:reel|p|tv)\/([^/?#]+)/i)
  if (m) return { mode: 'iframe', src: `https://www.instagram.com/reel/${m[1]}/embed/` }

  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i)
  if (m) return { mode: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` }

  return { mode: 'link', href: u }
}

/**
 * Lista de URLs para o carrossel do TDV (mín. 1 entrada — placeholder se vazio).
 */
export function getPlaceImageUrls(place) {
  const real = getRealPlaceImageUrls(place)
  return real.length > 0 ? real : [PLACEHOLDER_COVER]
}

export function getPlaceCoverImageUrl(place) {
  return getPlaceImageUrls(place)[0] ?? PLACEHOLDER_COVER
}
