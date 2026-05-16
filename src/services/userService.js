import api from './api'

/**
 * Endpoints legacy (`/users/me/checkout-complete`, `/users/me/upgrade-planejamento`)
 * devolvem `{ message, ... }` sem chave `data`. O normalizador do `api.js`
 * mapeia o objeto inteiro para `body.data`, então `res.body.data` aqui é
 * sempre o payload utilizável.
 */
export const userService = {
  completeCheckout: (options = {}) =>
    api
      .post('/users/me/checkout-complete', {
        paymentApproved: options.paymentApproved === true,
        paymentStatus: options.paymentStatus,
      })
      .then((res) => res.body.data),

  /** Dev/demo: ativa planejamento sem Mercado Pago (rota só existe fora de produção). */
  activatePlanningDev: () =>
    api.post('/users/me/upgrade-planejamento').then((res) => res.body.data),

  updateProfile: (userId, { name, email }) =>
    api.put(`/users/${userId}`, { name, email }).then((res) => res.body.data),
}
