/**
 * Resolução de papel (role) do usuário no frontend.
 *
 * Com a auth via cookie httpOnly (padrão BFF), o JWT não é mais acessível ao
 * JS — não dá (nem deve) decodificar o token no cliente. A fonte da verdade do
 * `role` é o objeto `user` carregado de `GET /users/me` (já sanitizado pelo
 * backend com `role: 'admin' | 'user'`).
 */
export function resolveIsAdmin(user) {
  return user?.role === 'admin'
}
