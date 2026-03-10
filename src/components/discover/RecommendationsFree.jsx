import { useEffect, useState } from 'react'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { placeService } from '../../services/placeService'

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80'
const FAVORITES_KEY = 'goofly_recommendation_favorites'

const INTERESTS = [
  { slug: 'historia', label: 'História' },
  { slug: 'arte-e-cultura', label: 'Arte e Cultura' },
  { slug: 'aventura', label: 'Aventura' },
  { slug: 'vida-noturna', label: 'Vida Noturna' },
  { slug: 'restaurantes-e-gastronomia', label: 'Gastronomia' },
  { slug: 'natureza-paisagens', label: 'Natureza' },
  { slug: 'compras', label: 'Compras' },
  { slug: 'fotografia', label: 'Fotografia' },
  { slug: 'espiritualidade', label: 'Espiritualidade' },
  { slug: 'esportes', label: 'Esportes' },
  { slug: 'musica-shows', label: 'Música e Shows' },
  { slug: 'arquitetura', label: 'Arquitetura' },
  { slug: 'familia', label: 'Família' },
  { slug: 'romantico', label: 'Romântico' },
  { slug: 'tecnologia-inovacao', label: 'Tecnologia' },
]

const TRAVEL_STYLES = [
  { value: '', label: 'Qualquer' },
  { value: 'relaxante', label: 'Relaxante' },
  { value: 'aventura', label: 'Aventura' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'gastronomico', label: 'Gastronômico' },
  { value: 'romantico', label: 'Romântico' },
  { value: 'familia', label: 'Família' },
]

const DURATIONS = [
  { value: '', label: 'Qualquer' },
  { value: 'dia-passeio', label: 'Dia de passeio' },
  { value: 'fim-de-semana', label: 'Fim de semana' },
  { value: '1-semana', label: '1 semana' },
  { value: '2-semanas', label: '2+ semanas' },
]

export function RecommendationsFree({ isAuthenticated }) {
  const [interests, setInterests] = useState([])
  const [travelStyle, setTravelStyle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [favorites, setFavorites] = useState(new Set())
  const [favoritesList, setFavoritesList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const toggleInterest = (slug) => {
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : prev.length >= 5 ? prev : [...prev, slug]
    )
  }

  const loadFavorites = async () => {
    if (isAuthenticated) {
      try {
        const data = await placeService.getFavorites()
        setFavorites(new Set(data.map((f) => f.recommendationId || f.id)))
        setFavoritesList(data.map((f) => ({ ...f, id: f.id, recommendationId: f.recommendationId })))
      } catch (_) {
        setFavorites(new Set())
        setFavoritesList([])
      }
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
        const ids = new Set(stored.map((f) => f.recommendationId || f.id))
        setFavorites(ids)
        setFavoritesList(stored.map((f) => ({ ...f, recommendationId: f.recommendationId || f.id })))
      } catch (_) {
        setFavorites(new Set())
        setFavoritesList([])
      }
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [isAuthenticated])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (interests.length < 1) {
      setError('Selecione pelo menos 1 interesse')
      return
    }
    setLoading(true)
    try {
      const { recommendations: recs } = await placeService.getRecommendationsFree({
        interests,
        travelStyle: travelStyle || undefined,
        description: description.trim() || undefined,
        duration: duration || undefined,
      })
      setRecommendations(recs || [])
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erro ao buscar recomendações')
    } finally {
      setLoading(false)
    }
  }

  const handleFavorite = async (rec) => {
    const payload = {
      recommendationId: rec.id,
      destination: rec.location || '',
      name: rec.name,
      description: rec.description,
      location: rec.location,
      category: rec.category,
      imageUrl: rec.imageUrl,
    }
    const isFav = favorites.has(rec.id)
    if (isFav) {
      if (isAuthenticated) {
        try {
          const favs = await placeService.getFavorites()
          const fav = favs.find((f) => (f.recommendationId || f.id) === rec.id)
          if (fav) await placeService.removeFavorite(fav.id)
        } catch (_) {}
      } else {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
        localStorage.setItem(
          FAVORITES_KEY,
          JSON.stringify(stored.filter((f) => (f.recommendationId || f.id) !== rec.id))
        )
      }
      setFavorites((prev) => {
        const next = new Set(prev)
        next.delete(rec.id)
        return next
      })
      setFavoritesList((prev) => prev.filter((f) => (f.recommendationId || f.id) !== rec.id))
    } else {
      if (isAuthenticated) {
        try {
          const res = await placeService.addFavorite(payload)
          const newFav = res.data?.data || res.data
          if (newFav) setFavoritesList((prev) => [...prev, { ...newFav, recommendationId: rec.id }])
        } catch (_) {}
      } else {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
        const item = { ...payload, id: rec.id, recommendationId: rec.id }
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...stored, item]))
        setFavoritesList((prev) => [...prev, item])
      }
      setFavorites((prev) => new Set([...prev, rec.id]))
    }
  }

  const removeFavoriteFromList = async (fav) => {
    const rid = fav.recommendationId || fav.id
    if (isAuthenticated) {
      try {
        await placeService.removeFavorite(fav.id)
      } catch (_) {}
    } else {
      const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(stored.filter((f) => (f.recommendationId || f.id) !== rid)))
    }
    setFavorites((prev) => {
      const next = new Set(prev)
      next.delete(rid)
      return next
    })
    setFavoritesList((prev) => prev.filter((f) => (f.recommendationId || f.id) !== rid))
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark p-6 md:p-8">
        <h3 className="text-lg font-bold mb-6">Descubra 3 lugares para sua próxima viagem</h3>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">{error}</div>
        )}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">Interesses * (máx. 5)</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(({ slug, label }) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleInterest(slug)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    interests.includes(slug)
                      ? 'bg-primary text-[#1c1c0d]'
                      : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold mb-2">Estilo de viagem</label>
              <select
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
              >
                {TRAVEL_STYLES.map(({ value, label }) => (
                  <option key={value || 'any'} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Duração</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
              >
                {DURATIONS.map(({ value, label }) => (
                  <option key={value || 'any'} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Descrição (até 500 caracteres)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Preferências especiais..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark resize-none"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            {loading ? 'Buscando...' : 'Descobrir 3 lugares'}
          </Button>
        </div>
      </form>

      {submitted && (
        <div>
          <h4 className="text-lg font-bold mb-4">Suas recomendações</h4>
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl overflow-hidden border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm"
                >
                  <div
                    className="aspect-[4/3] bg-cover bg-center"
                    style={{ backgroundImage: `url(${rec.imageUrl || PLACEHOLDER_IMAGE})` }}
                  />
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">{rec.category}</span>
                      <button
                        type="button"
                        onClick={() => handleFavorite(rec)}
                        className="p-1 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                      >
                        <Icon
                          name="favorite"
                          className={favorites.has(rec.id) ? 'text-red-500' : 'text-text-secondary'}
                          style={favorites.has(rec.id) ? { fontVariationSettings: "'FILL' 1" } : {}}
                        />
                      </button>
                    </div>
                    <h5 className="font-bold text-lg mb-1">{rec.name}</h5>
                    <p className="text-sm text-text-secondary mb-2 flex items-center gap-1">
                      <Icon name="location_on" className="text-sm" />
                      {rec.location}
                    </p>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-2">{rec.description}</p>
                    {rec.suggestedDuration && (
                      <p className="text-xs text-text-secondary">{rec.suggestedDuration}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary">Nenhuma recomendação encontrada.</p>
          )}
        </div>
      )}

      {favoritesList.length > 0 && (
        <div className="mt-10">
          <h4 className="text-lg font-bold mb-4">Meus Favoritos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoritesList.map((fav) => (
              <div
                key={fav.id || fav.recommendationId}
                className="rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex"
              >
                <div
                  className="w-24 shrink-0 aspect-square bg-cover bg-center"
                  style={{ backgroundImage: `url(${fav.imageUrl || PLACEHOLDER_IMAGE})` }}
                />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-primary uppercase">{fav.category}</span>
                    <button
                      type="button"
                      onClick={() => removeFavoriteFromList(fav)}
                      className="p-1 rounded-full hover:bg-red-500/10 text-text-secondary hover:text-red-500 transition-colors"
                    >
                      <Icon name="close" className="text-sm" />
                    </button>
                  </div>
                  <h5 className="font-bold truncate">{fav.name}</h5>
                  <p className="text-xs text-text-secondary truncate">{fav.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
