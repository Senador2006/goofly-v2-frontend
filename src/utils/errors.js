/**
 * Mensagem de erro legível a partir de respostas axios/API Goofly.
 */
export function getRequestErrorMessage(err, fallback = 'Ocorreu um erro. Tente novamente.') {
  const apiMsg = err?.response?.data?.error?.message
  if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg.trim()
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim()
  return fallback
}
