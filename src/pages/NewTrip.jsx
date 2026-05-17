import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { GooglePlaceAutocompleteField } from '../components/planning/GooglePlaceAutocompleteField'
import { tripService } from '../services/tripService'
import { hasGoogleMapsApiKey } from '../services/googleMapsPlacesLoader'
import { readLatLng } from '../utils/coordinates'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

// Constantes do PRE_TRIP_FORM.md
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

const ITINERARY_STYLES = [
  { value: 'equilibrado', label: 'Equilibrado', desc: 'Balanceia atividades e tempo livre' },
  { value: 'ativo', label: 'Ativo', desc: 'Muitas atividades por dia' },
  { value: 'esportes', label: 'Esportes', desc: 'Foco em atividades físicas' },
  { value: 'eventos', label: 'Eventos', desc: 'Prioriza eventos e shows' },
  { value: 'relaxante', label: 'Relaxante', desc: 'Mais tempo livre' },
]

const ACCOMMODATION_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'hostel', label: 'Albergue' },
  { value: 'apartment', label: 'Apartamento' },
  { value: 'other', label: 'Outro' },
]

const AVOID_OPTIONS = [
  { slug: 'multidoes', label: 'Multidões' },
  { slug: 'gastos-altos', label: 'Gastos Altos' },
  { slug: 'atividades-noturnas', label: 'Atividades Noturnas' },
  { slug: 'esportes-radicais', label: 'Esportes Radicais' },
  { slug: 'lugares-turisticos', label: 'Lugares Turísticos' },
  { slug: 'comida-picante', label: 'Comida Picante' },
  { slug: 'transporte-publico-lotado', label: 'Transporte Lotado' },
  { slug: 'lugares-barulhentos', label: 'Lugares Barulhentos' },
  { slug: 'atividades-ao-ar-livre', label: 'Atividades ao Ar Livre' },
]

const PRIORITIZE_OPTIONS = [
  { slug: 'lugares-escondidos', label: 'Lugares Escondidos' },
  { slug: 'cultura-local', label: 'Cultura Local' },
  { slug: 'gastronomia-local', label: 'Gastronomia Local' },
  { slug: 'vistas-panoramicas', label: 'Vistas Panorâmicas' },
  { slug: 'arquitetura-historica', label: 'Arquitetura Histórica' },
  { slug: 'mercados-locais', label: 'Mercados Locais' },
  { slug: 'parques-natureza', label: 'Parques e Natureza' },
  { slug: 'arte-de-rua', label: 'Arte de Rua' },
  { slug: 'vida-noturna-local', label: 'Vida Noturna Local' },
]

const TRIP_TYPES = [
  { value: 'tourism', label: 'Turismo' },
  { value: 'business', label: 'Negócios' },
  { value: 'adventure', label: 'Aventura' },
  { value: 'romantic', label: 'Romântica' },
  { value: 'family', label: 'Familiar' },
  { value: 'other', label: 'Outro' },
]

const CURRENCIES = ['USD', 'EUR', 'BRL', 'GBP']

const STEPS = [
  { id: 1, label: 'Destinos' },
  { id: 2, label: 'Estadia' },
  { id: 3, label: 'Interesses' },
  { id: 4, label: 'Preferências' },
]

function generateId() {
  return 'dest-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

/** Garante 1 estadia por destino (ex.: usuário pulou o passo 2 pelas abas). */
function getPaddedAccommodations(destinations, accommodations) {
  const dests = destinations || []
  const accs = [...(accommodations || [])]
  for (let i = accs.length; i < dests.length; i++) {
    const dest = dests[i]
    accs.push({
      destinationId: dest?.id,
      type: 'hotel',
      name: '',
      address: '',
      checkIn: dest?.arrivalDate || '',
      checkOut: dest?.departureDate || '',
      nights: 0,
    })
  }
  return accs.slice(0, dests.length)
}

export function NewTrip() {
  useDocumentTitle('Nova viagem')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    destinations: [{ id: generateId(), city: '', country: '', arrivalDate: '', departureDate: '', order: 1 }],
    accommodations: [],
    interests: [],
    tripDescription: '',
    itineraryStyle: 'equilibrado',
    tripPurpose: '',
    avoidPreferences: [],
    prioritizePreferences: [],
    prioritizeCustom: '',
    budget: '',
    currency: 'USD',
    travelers: { adults: 1, children: 0 },
    tripType: '',
  })

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const updateDestination = (index, updates) => {
    setFormData((prev) => {
      const dests = [...prev.destinations]
      dests[index] = { ...dests[index], ...updates }
      return { ...prev, destinations: dests }
    })
  }

  const addDestination = () => {
    const last = formData.destinations[formData.destinations.length - 1]
    const dep = last?.departureDate || ''
    setFormData((prev) => ({
      ...prev,
      destinations: [
        ...prev.destinations,
        { id: generateId(), city: '', country: '', arrivalDate: dep, departureDate: '', order: prev.destinations.length + 1 },
      ],
    }))
  }

  const removeDestination = (index) => {
    if (formData.destinations.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((_, i) => i !== index).map((d, i) => ({ ...d, order: i + 1 })),
    }))
  }

  useEffect(() => {
    if (step !== 2) return
    setFormData((prev) => {
      const dests = prev.destinations
      const accs = prev.accommodations || []
      if (accs.length >= dests.length) return prev
      const next = [...accs]
      for (let i = next.length; i < dests.length; i++) {
        const dest = dests[i]
        next[i] = {
          destinationId: dest?.id,
          type: 'hotel',
          name: '',
          address: '',
          checkIn: dest?.arrivalDate || '',
          checkOut: dest?.departureDate || '',
          nights: 0,
        }
      }
      return { ...prev, accommodations: next }
    })
  }, [step])

  const updateAccommodation = (index, updates) => {
    setFormData((prev) => {
      const accs = [...(prev.accommodations || [])]
      accs[index] = { ...accs[index], ...updates }
      return { ...prev, accommodations: accs }
    })
  }

  const toggleMulti = (field, value) => {
    setFormData((prev) => {
      const arr = prev[field] || []
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
      return { ...prev, [field]: next }
    })
  }

  const validateStep = (s) => {
    if (s === 1) {
      const dests = formData.destinations
      for (const d of dests) {
        if (!d.city?.trim() || !d.country?.trim()) return 'Preencha cidade e país de cada destino'
        if (!readLatLng({ coordinates: d.coordinates })) {
          return `Selecione "${d.city.trim()}" nas sugestões do autocomplete para localizar o destino no mapa`
        }
        if (!d.arrivalDate || !d.departureDate) return 'Preencha as datas de cada destino'
        const arr = new Date(d.arrivalDate)
        const dep = new Date(d.departureDate)
        if (arr >= dep) return `Data de chegada deve ser anterior à saída em ${d.city}`
      }
      for (let i = 1; i < dests.length; i++) {
        const prevDep = new Date(dests[i - 1].departureDate)
        const currArr = new Date(dests[i].arrivalDate)
        if (currArr < prevDep) return 'Datas dos destinos devem ser sequenciais'
      }
      return null
    }
    if (s === 2) {
      const dests = formData.destinations
      const accs = getPaddedAccommodations(dests, formData.accommodations)
      if (accs.length < dests.length) return 'Preencha a estadia para cada destino'
      for (let i = 0; i < accs.length; i++) {
        const a = accs[i]
        if (!a.type || !a.checkIn || !a.checkOut) return `Preencha check-in e check-out da estadia ${i + 1}`
        const dest = dests[i]
        const checkIn = new Date(a.checkIn)
        const checkOut = new Date(a.checkOut)
        const arr = new Date(dest.arrivalDate)
        const dep = new Date(dest.departureDate)
        if (checkIn < arr) return `Check-in deve ser após a chegada em ${dest.city}`
        if (checkOut > dep) return `Check-out deve ser antes da saída de ${dest.city}`
      }
      return null
    }
    if (s === 3) {
      if (!formData.interests?.length) return 'Selecione pelo menos 1 interesse'
      if (!formData.travelers?.adults || formData.travelers.adults < 1) return 'Informe o número de adultos'
      return null
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    if (step < 4) setStep(step + 1)
  }

  const handleBack = () => {
    setError(null)
    if (step > 1) setStep(step - 1)
  }

  const buildPayload = () => {
    const dests = formData.destinations.map((d, i) => ({
      id: d.id,
      city: d.city.trim(),
      country: d.country.trim(),
      ...(d.coordinates ? { coordinates: d.coordinates } : {}),
      arrivalDate: d.arrivalDate,
      departureDate: d.departureDate,
      order: i + 1,
    }))
    const accs = getPaddedAccommodations(formData.destinations, formData.accommodations).map((a, i) => ({
      destinationId: dests[i]?.id,
      type: a.type || 'hotel',
      name: a.name?.trim() || '',
      address: a.address?.trim() || '',
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      nights: a.nights || 0,
    }))
    const prior = [...(formData.prioritizePreferences || [])]
    if (formData.prioritizeCustom?.trim()) prior.push('custom: ' + formData.prioritizeCustom.trim())
    return {
      destinations: dests,
      accommodations: accs,
      interests: formData.interests,
      tripDescription: formData.tripDescription?.trim() || undefined,
      itineraryStyle: formData.itineraryStyle || 'equilibrado',
      tripPurpose: formData.tripPurpose?.trim() || undefined,
      avoidPreferences: formData.avoidPreferences || [],
      prioritizePreferences: prior,
      budget: formData.budget ? Number(formData.budget) : undefined,
      currency: formData.currency || 'USD',
      travelers: { adults: formData.travelers.adults || 1, children: formData.travelers.children || 0 },
      tripType: formData.tripType || undefined,
    }
  }

  const runCreateTrip = async () => {
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s)
      if (err) {
        setError(err)
        setStep(s)
        return
      }
    }
    setLoading(true)
    setError(null)
    try {
      const payload = buildPayload()
      const trip = await tripService.createTrip(payload)
      navigate(`/trips/${trip.id}/itinerary`)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Erro ao criar viagem')
    } finally {
      setLoading(false)
    }
  }

  /** Enter em campos ou submit implícito só avança até o passo 4; criar viagem só no último passo. */
  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (step < 4) {
      handleNext()
      return
    }
    void runCreateTrip()
  }

  return (
    <div>
      <Header
        title="Nova Viagem"
        subtitle="Preencha o formulário para criar sua próxima aventura"
      />
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 mb-8">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                step === s.id ? 'bg-primary text-foreground' : 'bg-surface-light dark:bg-surface-dark'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleFormSubmit} className="bg-white dark:bg-card-dark rounded-xl p-6 md:p-8 border border-border-light dark:border-border-dark">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
              <p>{error}</p>
              {(error.includes('temporariamente') || error.includes('comunicar')) && (
                <p className="mt-2 text-xs opacity-90">Tente novamente em alguns segundos ou reinicie o servidor.</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Destinos e Datas</h3>
              {formData.destinations.map((dest, i) => (
                <div key={dest.id} className="p-4 rounded-xl border border-border-light dark:border-border-dark space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-secondary">Destino {i + 1}</span>
                    {formData.destinations.length > 1 && (
                      <button type="button" onClick={() => removeDestination(i)} className="text-red-500 text-sm">
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-sm font-semibold mb-2 text-[#1c1c0d] dark:text-white">
                        Cidade *
                      </span>
                      {hasGoogleMapsApiKey() ? (
                        <>
                          <GooglePlaceAutocompleteField
                            key={`ac-${dest.id}`}
                            id={`planning-city-ac-${dest.id}`}
                            value={dest.city}
                            placeholder="Ex.: Paris, Tóquio, Porto…"
                            disabled={loading}
                            onDraftChange={(text) => updateDestination(i, { city: text })}
                            onResolved={(patch) =>
                              updateDestination(i, {
                                ...(patch.city != null ? { city: patch.city } : {}),
                                ...(patch.country != null ? { country: patch.country } : {}),
                                ...(patch.coordinates ? { coordinates: patch.coordinates } : {}),
                              })
                            }
                          />
                          <p className="mt-2 text-[11px] text-text-secondary/90 leading-snug flex items-start gap-1.5">
                            <Icon name="travel_explore" className="text-sm shrink-0 mt-px opacity-80" aria-hidden />
                            Pesquise com o Place Autocomplete (novo) do Google e escolha uma sugestão — preenchemos país e
                            coordenadas quando disponíveis ({' '}
                            <a
                              href="https://developers.google.com/maps/documentation/javascript/place-autocomplete-new?hl=pt-br"
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-primary underline font-semibold"
                            >
                              documentação
                            </a>
                            ).
                          </p>
                        </>
                      ) : (
                        <input
                          type="text"
                          id={`planning-city-${dest.id}`}
                          value={dest.city}
                          onChange={(e) => updateDestination(i, { city: e.target.value })}
                          placeholder="Ex: Paris"
                          className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                        />
                      )}
                    </label>
                    <div>
                      <label className="block text-sm font-semibold mb-2">País *</label>
                      <input
                        type="text"
                        value={dest.country}
                        onChange={(e) => updateDestination(i, { country: e.target.value })}
                        placeholder="Ex: França"
                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Chegada *</label>
                      <input
                        type="date"
                        value={dest.arrivalDate}
                        onChange={(e) => updateDestination(i, { arrivalDate: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Saída *</label>
                      <input
                        type="date"
                        value={dest.departureDate}
                        onChange={(e) => updateDestination(i, { departureDate: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addDestination}>
                <Icon name="add" />
                Adicionar destino
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Locais de Estadia</h3>
              <p className="text-sm text-text-secondary">Informe a hospedagem para cada destino.</p>
              {(formData.accommodations || []).slice(0, formData.destinations.length).map((acc, i) => {
                const dest = formData.destinations[i]
                return (
                  <div key={dest?.id || i} className="p-4 rounded-xl border border-border-light dark:border-border-dark space-y-4">
                    <span className="text-sm font-bold text-text-secondary">{dest?.city || `Destino ${i + 1}`}</span>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Tipo *</label>
                      <select
                        value={acc.type || 'hotel'}
                        onChange={(e) => updateAccommodation(i, { type: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                      >
                        {ACCOMMODATION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Nome / Endereço</label>
                      <input
                        type="text"
                        value={acc.name || ''}
                        onChange={(e) => updateAccommodation(i, { name: e.target.value })}
                        placeholder="Ex: Hotel Plaza Athénée"
                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Check-in *</label>
                        <input
                          type="date"
                          value={acc.checkIn || ''}
                          onChange={(e) => updateAccommodation(i, { checkIn: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Check-out *</label>
                        <input
                          type="date"
                          value={acc.checkOut || ''}
                          onChange={(e) => updateAccommodation(i, { checkOut: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Interesses e Preferências</h3>
              <div>
                <label className="block text-sm font-semibold mb-2">Interesses * (mín. 1)</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('interests', slug)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        formData.interests.includes(slug)
                          ? 'bg-primary text-foreground'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Descrição da viagem (opcional)</label>
                <textarea
                  value={formData.tripDescription}
                  onChange={(e) => updateField('tripDescription', e.target.value.slice(0, 2000))}
                  placeholder="Descreva como você imagina sua viagem ideal..."
                  rows={3}
                  maxLength={2000}
                  className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark resize-none"
                />
                <span className="text-xs text-text-secondary">{formData.tripDescription.length}/2000</span>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Estilo do roteiro</label>
                <div className="flex flex-wrap gap-2">
                  {ITINERARY_STYLES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('itineraryStyle', value)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.itineraryStyle === value
                          ? 'bg-primary text-foreground'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Motivo da viagem (opcional)</label>
                <textarea
                  value={formData.tripPurpose}
                  onChange={(e) => updateField('tripPurpose', e.target.value.slice(0, 500))}
                  placeholder="Ex: Lugares fotográficos, eventos específicos..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark resize-none"
                />
                <span className="text-xs text-text-secondary">{formData.tripPurpose.length}/500</span>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Viajantes *</label>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Adultos</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.travelers.adults}
                      onChange={(e) => updateField('travelers', { ...formData.travelers, adults: parseInt(e.target.value, 10) || 1 })}
                      className="w-20 px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Crianças</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.travelers.children}
                      onChange={(e) => updateField('travelers', { ...formData.travelers, children: parseInt(e.target.value, 10) || 0 })}
                      className="w-20 px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Preferências Detalhadas</h3>
              <div>
                <label className="block text-sm font-semibold mb-2">Coisas a evitar (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {AVOID_OPTIONS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('avoidPreferences', slug)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        formData.avoidPreferences.includes(slug)
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Coisas a priorizar (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIZE_OPTIONS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('prioritizePreferences', slug)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        formData.prioritizePreferences.includes(slug)
                          ? 'bg-primary text-foreground'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.prioritizeCustom}
                  onChange={(e) => updateField('prioritizeCustom', e.target.value)}
                  placeholder="Outro (custom)"
                  className="mt-2 w-full px-4 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Orçamento (opcional)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.budget}
                    onChange={(e) => updateField('budget', e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Moeda</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => updateField('currency', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Tipo de viagem (opcional)</label>
                <select
                  value={formData.tripType}
                  onChange={(e) => updateField('tripType', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
                >
                  <option value="">Selecione</option>
                  {TRIP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 1}>
              Voltar
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={handleNext}>
                Próximo
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Viagem'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
