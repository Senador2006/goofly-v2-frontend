import api from './api'

/**
 * Endpoints legacy (`/users/me/checkout-complete`, `/users/me/upgrade-planejamento`)
 * devolvem `{ message, ... }` sem chave `data`. O normalizador do `api.js`
 * mapeia o objeto inteiro para `body.data`, então `res.body.data` aqui é
 * sempre o payload utilizável.
 */
function normalizeActivationPayload(payload) {
  if (!payload) return null
  const nestedUser = payload.user && typeof payload.user === 'object' ? payload.user : null
  const base = nestedUser || (payload.id || payload.email ? payload : null)
  const subscription_type = base?.subscription_type || payload.subscription_type
  const subscription_expires_at = base?.subscription_expires_at ?? payload.subscription_expires_at
  if (!subscription_type) return base || payload
  return {
    ...(base || {}),
    subscription_type,
    subscription_expires_at: subscription_expires_at ?? null
  }
}

export const userService = {
  completeCheckout: (options = {}) =>
    api
      .post('/users/me/checkout-complete', {
        paymentApproved: options.paymentApproved === true,
        paymentStatus: options.paymentStatus,
      })
      .then((res) => normalizeActivationPayload(res.body.data)),

  /** Dev/demo: ativa planejamento sem Mercado Pago (rota só existe fora de produção). */
  activatePlanningDev: () =>
    api.post('/users/me/upgrade-planejamento').then((res) => normalizeActivationPayload(res.body.data)),

  updateProfile: (userId, { name, email }) =>
    api.put(`/users/${userId}`, { name, email }).then((res) => res.body.data),
}
