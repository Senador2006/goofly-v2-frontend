import api from './api'

/**
 * Endpoints legacy (`/users/me/checkout-complete`, `/users/me/upgrade-planejamento`)
 * devolvem `{ message, ... }` sem chave `data`. O normalizador do `api.js`
 * mapeia o objeto inteiro para `body.data`, então `res.body.data` aqui é
 * sempre o payload utilizável.
 */
export const userService = {
  completeCheckout: () =>
    api.post('/users/me/checkout-complete').then((res) => res.body.data),

  updateProfile: (userId, { name, email }) =>
    api.put(`/users/${userId}`, { name, email }).then((res) => res.body.data),
}
