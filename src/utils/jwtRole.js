/**
 * Resolução de papel (role) do usuário no frontend.
 *
 * Com a auth via cookie httpOnly (padrão BFF), o JWT não é mais acessível ao
 * JS — não dá (nem deve) decodificar o token no cliente. A fonte da verdade do
 * `role` é o objeto `user` carregado de `GET /users/me` (já sanitizado pelo
 * backend com `role: 'admin' | 'user'`).
 *
 * Não use isto sozinho para liberar UI admin: combine com `sessionVerified`
 * do AuthContext (ver `isAdmin`). Dados sensíveis dependem de `requireAdmin`
 * no gateway/services.
 */
export function resolveIsAdmin(user) {
  return user?.role === 'admin'
}
