import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { DateInput } from '../components/common/DateInput'
import { GooglePlaceAutocompleteField } from '../components/planning/GooglePlaceAutocompleteField'
import { AccommodationDestinationGroup } from '../components/planning/AccommodationStayForm'
import { tripService } from '../services/tripService'
import { hasGoogleMapsApiKey } from '../services/googleMapsPlacesLoader'
import { stepErrorKey } from '../utils/newTripStep1Validation'
import {
  collectStepErrors,
  fieldErrorMessage,
  furthestUnlockedStep as computeFurthestUnlocked,
  stepFieldErrorMessage,
} from '../utils/newTripFormValidation'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { trackMetaEvent } from '../utils/metaPixel'
import {
  accommodationHasContent,
  createEmptyAccommodation,
  generateAccommodationId,
  getAccommodationsForDestination,
  serializeAccommodation,
} from '../utils/accommodationForm'
import { resolveAccommodationDayOverlaps, previewAccommodationReplacements, suggestStayWindowAllowingOverlap } from '../utils/accommodationStayContract'
import { AccommodationReplaceConfirmDialog } from '../components/itinerary/AccommodationReplaceConfirmDialog'
import {
  addCalendarDaysIso,
  todayIsoCalendarDate,
  tripSpanMaxDepartureIso,
} from '../utils/dateInput'

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
  { value: 'relaxante', label: 'Tranquilo', desc: 'Mais tempo livre' },
  { value: 'equilibrado', label: 'Equilibrado', desc: 'Balanceia atividades e tempo livre' },
  { value: 'ativo', label: 'Ativo', desc: 'Muitas atividades por dia' },
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
  { slug: 'lugares-famosos', label: 'Lugares Famosos' },
  { slug: 'landmarks', label: 'Landmarks' },
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

function applyDestinationDateRules(destinations, index, updates) {
  // Mantém datas inválidas no estado para a validação explicar o motivo real
  // (ex.: "saída após chegada"), em vez de limpar e cair em "preencha a data".
  const dests = destinations.map((d, i) => (i === index ? { ...d, ...updates } : { ...d }))
  return { dests, notices: [] }
}

function FieldHint({ children }) {
  if (!children) return null
  return (
    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 leading-snug" role="alert">
      {children}
    </p>
  )
}

export function NewTrip() {
  useDocumentTitle('Nova viagem')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [apiError, setApiError] = useState(null)
  const [stayNotice, setStayNotice] = useState(null)
  const [pendingStayAdvance, setPendingStayAdvance] = useState(null)
  const errorBannerRef = useRef(null)
  const [formData, setFormData] = useState({
    destinations: [{ id: generateId(), city: '', country: '', arrivalDate: '', departureDate: '', order: 1 }],
    accommodations: [],
    interests: [],
    tripDescription: '',
    itineraryStyle: 'equilibrado',
    avoidPreferences: [],
    prioritizePreferences: [],
    avoidCustom: '',
    prioritizeCustom: '',
    budget: '',
    currency: 'BRL',
    travelers: { adults: 1, children: 0 },
  })
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const stepRef = useRef(step)
  stepRef.current = step

  const step1Options = () => ({ requirePlaceSelection: hasGoogleMapsApiKey() })

  const clearFormErrors = () => {
    setErrors([])
    setApiError(null)
  }

  const showStepErrors = (list) => {
    setApiError(null)
    setErrors(list)
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setApiError(null)
  }

  const updateDestination = (index, updates) => {
    const prev = formDataRef.current
    const { dests, notices } = applyDestinationDateRules(prev.destinations, index, updates)
    setFormData({ ...prev, destinations: dests })
    if (notices.length > 0) {
      setApiError(null)
      setErrors(notices)
    }
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
    const removedId = formData.destinations[index]?.id
    setFormData((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((_, i) => i !== index).map((d, i) => ({ ...d, order: i + 1 })),
      accommodations: (prev.accommodations || []).filter((a) => a.destinationId !== removedId),
    }))
  }

  const updateAccommodation = (accId, updates) => {
    setFormData((prev) => ({
      ...prev,
      accommodations: (prev.accommodations || []).map((a) =>
        a.id === accId ? { ...a, ...updates } : a,
      ),
    }))
  }

  const addAccommodation = (destinationId) => {
    const dest = formData.destinations.find((d) => d.id === destinationId)
    const window = dest
      ? suggestStayWindowAllowingOverlap(dest, formData.accommodations || [])
      : null
    if (!window) {
      showStepErrors([
        {
          code: 'stay_window',
          message: `Não foi possível sugerir datas em ${dest?.city || 'este destino'}.`,
          field: 'accommodation',
        },
      ])
      return
    }
    clearFormErrors()
    setFormData((prev) => ({
      ...prev,
      accommodations: [
        ...(prev.accommodations || []),
        createEmptyAccommodation(dest, window, prev.accommodations),
      ],
    }))
  }

  const removeAccommodation = (accId) => {
    setFormData((prev) => ({
      ...prev,
      accommodations: (prev.accommodations || []).filter((a) => a.id !== accId),
    }))
  }

  const toggleMulti = (field, value) => {
    setFormData((prev) => {
      const arr = prev[field] || []
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
      return { ...prev, [field]: next }
    })
  }

  const collectForStep = (s, data = formData) =>
    collectStepErrors(s, data, step1Options())

  const furthestUnlockedStep = (visited, data = formData) =>
    computeFurthestUnlocked(visited, data, step1Options())

  useEffect(() => {
    const nextMax = furthestUnlockedStep(maxReachedStep, formData)
    // Não encolhe maxReachedStep: o pico visitado permanece; o unlock recalcula pelos erros.
    if (step > nextMax) setStep(nextMax)
  }, [formData, maxReachedStep, step])

  useEffect(() => {
    if (errors.length === 0) return
    const remaining = collectForStep(step, formData)
    const remainingKeys = new Set(remaining.map(stepErrorKey))
    const stillValid = errors.filter((e) => remainingKeys.has(stepErrorKey(e)))
    if (stillValid.length !== errors.length) setErrors(stillValid)
  }, [formData, step, errors])

  const applyStayStepAndAdvance = (resolved, warnings) => {
    const empty = (formData.accommodations || []).filter((a) => !accommodationHasContent(a))
    setFormData((prev) => ({
      ...prev,
      accommodations: [...empty, ...resolved],
    }))
    setStayNotice(
      warnings.length > 0 ? warnings.map((w) => w.message).join(' ') : null,
    )
    setPendingStayAdvance(null)
    goToStep(3)
  }

  const advanceStepAfterValidation = (fromStep, data = formDataRef.current) => {
    const list = collectForStep(fromStep, data)
    if (list.length > 0) {
      showStepErrors(list)
      return
    }
    clearFormErrors()
    if (fromStep === 2) {
      const filled = (data.accommodations || []).filter(accommodationHasContent)
      const { accommodations: resolved, warnings } = resolveAccommodationDayOverlaps(filled)
      if (warnings.length > 0) {
        setPendingStayAdvance({
          resolved,
          warningMessages: warnings.map((w) => w.message),
        })
        return
      }
      applyStayStepAndAdvance(resolved, warnings)
      return
    }
    setStayNotice(null)
    if (fromStep < 4) goToStep(fromStep + 1)
  }

  const handleNextClick = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        advanceStepAfterValidation(stepRef.current, formDataRef.current)
      })
    })
  }

  const handleBack = () => {
    clearFormErrors()
    setStayNotice(null)
    setPendingStayAdvance(null)
    if (step > 1) setStep(step - 1)
  }

  const goToStep = (next) => {
    setStep(next)
    setMaxReachedStep((prev) => Math.max(prev, next))
  }

  const tryGoToStep = (next) => {
    if (next === step) return
    const allowed = furthestUnlockedStep(maxReachedStep, formData)
    if (next > allowed) {
      const blocker = collectForStep(allowed, formData)
      if (blocker.length > 0) showStepErrors(blocker)
      return
    }
    for (let s = 1; s < next; s += 1) {
      const list = collectForStep(s, formData)
      if (list.length > 0) {
        showStepErrors(list)
        setMaxReachedStep(s)
        setStep(s)
        return
      }
    }
    clearFormErrors()
    setStayNotice(null)
    goToStep(next)
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
    const rawAccs = (formData.accommodations || [])
      .filter(accommodationHasContent)
      .map((a) => serializeAccommodation({ ...a, id: a.id || generateAccommodationId() }))
    const { accommodations: accs } = resolveAccommodationDayOverlaps(rawAccs)
    const avoid = [...(formData.avoidPreferences || [])]
    if (formData.avoidCustom?.trim()) avoid.push('custom: ' + formData.avoidCustom.trim())
    const prior = [...(formData.prioritizePreferences || [])]
    if (formData.prioritizeCustom?.trim()) prior.push('custom: ' + formData.prioritizeCustom.trim())
    return {
      destinations: dests,
      accommodations: accs,
      interests: formData.interests,
      tripDescription: formData.tripDescription?.trim() || undefined,
      itineraryStyle: formData.itineraryStyle || 'equilibrado',
      avoidPreferences: avoid,
      prioritizePreferences: prior,
      budget: formData.budget ? Number(formData.budget) : undefined,
      currency: formData.currency || 'BRL',
      travelers: {
        adults: Math.max(1, Number(formData.travelers.adults) || 1),
        children: Math.max(0, Number(formData.travelers.children) || 0),
      },
    }
  }

  const runCreateTrip = async () => {
    for (let s = 1; s <= 4; s++) {
      const list = collectForStep(s)
      if (list.length > 0) {
        showStepErrors(list)
        setStep(s)
        return
      }
    }
    setLoading(true)
    clearFormErrors()
    try {
      const payload = buildPayload()
      const trip = await tripService.createTrip(payload)
      const dest = payload.destinations?.[0]
      const destLabel = dest
        ? [dest.city, dest.country].filter(Boolean).join(', ')
        : undefined
      trackMetaEvent('Lead', {
        content_name: destLabel || 'nova_viagem',
        content_ids: trip?.id ? [String(trip.id)] : undefined,
        content_category: 'trip_planning',
      })
      navigate(`/trips/${trip.id}/itinerary?tab=tdv`)
    } catch (err) {
      setApiError(err.response?.data?.error?.message || err.message || 'Erro ao criar viagem')
      setErrors([])
      requestAnimationFrame(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Enter implicitamente só avança etapas 1→3 (Próximo). No passo 4 não faz requisição.
   * POST /trips apenas no clique do botão "Criar viagem".
   */
  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (step < 4) handleNextClick()
  }

  const handleCreateTripClick = () => {
    void runCreateTrip()
  }

  const fieldInputClass =
    'w-full min-w-0 px-4 py-3 text-base rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark'
  const fieldInputInvalidClass =
    'w-full min-w-0 px-4 py-3 text-base rounded-xl border border-red-500/60 dark:border-red-400/50 bg-background-light dark:bg-background-dark'
  const skipStay =
    step === 2 && !(formData.accommodations || []).some(accommodationHasContent)
  const unlockedStep = furthestUnlockedStep(maxReachedStep)
  const todayIso = todayIsoCalendarDate()
  const firstArrival = formData.destinations[0]?.arrivalDate || ''
  const tripMaxDeparture = firstArrival ? tripSpanMaxDepartureIso(firstArrival) : undefined
  const bannerMessages = [
    ...errors.map((e) => e.message),
    ...(apiError ? [apiError] : []),
  ]
  const wizardNav = (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={handleBack}
        disabled={step === 1}
        className="min-h-11 w-full"
      >
        Voltar
      </Button>
      {step < 4 ? (
        <Button type="button" onClick={handleNextClick} className="min-h-11 w-full">
          {skipStay ? 'Pular' : 'Próximo'}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={loading}
          onClick={handleCreateTripClick}
          className="min-h-11 w-full"
        >
          {loading ? 'Criando...' : 'Criar Viagem'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="mobile-task-shell max-w-2xl mx-auto">
      <div className="hidden md:block">
        <Header
          title="Nova Viagem"
          subtitle="Preencha o formulário para criar sua próxima aventura"
        />
      </div>
      <div className="md:hidden mb-4 min-w-0">
        <h1 className="text-xl font-black tracking-tight">Nova Viagem</h1>
        <p className="mt-1 text-sm text-text-secondary">Etapa {step} de 4</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5" role="tablist" aria-label="Etapas do formulário">
          {STEPS.map((s) => {
            const reachable = s.id <= unlockedStep
            const isCurrent = step === s.id
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={`${s.label}${reachable ? '' : ' (ainda não disponível)'}`}
                disabled={!reachable}
                onClick={() => tryGoToStep(s.id)}
                className={`flex min-h-8 min-w-0 items-center gap-1.5 overflow-visible rounded-lg px-1.5 py-1 text-left ${
                  isCurrent
                    ? 'bg-primary/20'
                    : 'bg-surface-light dark:bg-surface-dark'
                } ${reachable ? '' : 'opacity-45'}`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    isCurrent
                      ? 'bg-primary text-foreground'
                      : s.id < step
                        ? 'bg-primary/35 text-foreground dark:text-white'
                        : 'bg-white text-text-secondary dark:bg-card-dark'
                  }`}
                >
                  {s.id}
                </span>
                <span
                  className={`min-w-0 flex-1 text-[11px] font-semibold leading-none ${
                    isCurrent
                      ? 'text-foreground dark:text-white'
                      : 'text-text-secondary'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden md:flex gap-2 mb-8">
        {STEPS.map((s) => {
          const reachable = s.id <= unlockedStep
          const isCurrent = step === s.id
          return (
            <button
              key={s.id}
              type="button"
              disabled={!reachable}
              aria-label={`${s.label}${reachable ? '' : ' (ainda não disponível)'}`}
              onClick={() => {
                setStayNotice(null)
                tryGoToStep(s.id)
              }}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                isCurrent
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark'
              } ${reachable ? '' : 'opacity-45 cursor-not-allowed'}`}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="bg-white dark:bg-card-dark rounded-xl p-4 md:p-8 border border-border-light dark:border-border-dark min-w-0 max-w-full overflow-x-clip md:overflow-visible"
      >
          {bannerMessages.length > 0 && (
            <div
              ref={errorBannerRef}
              className="mb-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm"
              role="alert"
            >
              {bannerMessages.length === 1 ? (
                <p>{bannerMessages[0]}</p>
              ) : (
                <ul className="list-disc pl-4 space-y-1">
                  {bannerMessages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
              {apiError &&
                (apiError.includes('temporariamente') || apiError.includes('comunicar')) && (
                <p className="mt-2 text-xs opacity-90">Tente novamente em alguns segundos ou reinicie o servidor.</p>
              )}
            </div>
          )}
          {stayNotice && (
            <div
              className="mb-6 p-4 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-xl text-sm leading-relaxed"
              role="status"
            >
              <p>{stayNotice}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Destinos e Datas</h3>
              {formData.destinations.map((dest, i) => {
                const cityErr = fieldErrorMessage(errors, i, 'city')
                const countryErr = fieldErrorMessage(errors, i, 'country')
                const arrivalErr = fieldErrorMessage(errors, i, 'arrivalDate')
                const departureErr = fieldErrorMessage(errors, i, 'departureDate')
                const arrivalMin =
                  i > 0
                    ? formData.destinations[i - 1]?.departureDate || todayIso
                    : todayIso
                const departureMin = dest.arrivalDate
                  ? addCalendarDaysIso(dest.arrivalDate, 1) || undefined
                  : undefined
                return (
                <div key={dest.id} className="p-4 rounded-md md:rounded-xl border border-border-light dark:border-border-dark space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-text-secondary">Destino {i + 1}</span>
                    {formData.destinations.length > 1 && (
                      <button type="button" onClick={() => removeDestination(i)} className="text-red-500 text-sm">
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block min-w-0">
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
                        </>
                      ) : (
                        <input
                          type="text"
                          id={`planning-city-${dest.id}`}
                          value={dest.city}
                          onChange={(e) => updateDestination(i, { city: e.target.value })}
                          placeholder="Ex: Paris"
                          aria-invalid={cityErr ? 'true' : undefined}
                          className={cityErr ? fieldInputInvalidClass : fieldInputClass}
                        />
                      )}
                      <FieldHint>{cityErr}</FieldHint>
                    </label>
                    <div className="min-w-0">
                      <label className="block text-sm font-semibold mb-2">País *</label>
                      <input
                        type="text"
                        value={dest.country}
                        onChange={(e) => updateDestination(i, { country: e.target.value })}
                        placeholder="Ex: França"
                        aria-invalid={countryErr ? 'true' : undefined}
                        className={countryErr ? fieldInputInvalidClass : fieldInputClass}
                      />
                      <FieldHint>{countryErr}</FieldHint>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="min-w-0" data-field={`dest-${i}-arrival`}>
                      <label className="block text-sm font-semibold mb-2">Chegada *</label>
                      <DateInput
                        value={dest.arrivalDate}
                        onChange={(next) => updateDestination(i, { arrivalDate: next })}
                        aria-label="Chegada"
                        min={arrivalMin}
                        max={tripMaxDeparture}
                        error={arrivalErr}
                        className={`${fieldInputClass} !pr-10 sm:!pr-11`}
                      />
                    </div>
                    <div className="min-w-0" data-field={`dest-${i}-departure`}>
                      <label className="block text-sm font-semibold mb-2">Saída *</label>
                      <DateInput
                        value={dest.departureDate}
                        onChange={(next) => updateDestination(i, { departureDate: next })}
                        aria-label="Saída"
                        min={departureMin}
                        max={tripMaxDeparture}
                        error={departureErr}
                        className={`${fieldInputClass} !pr-10 sm:!pr-11`}
                      />
                    </div>
                  </div>
                </div>
                )
              })}
              {stepFieldErrorMessage(errors, 'span') ? (
                <FieldHint>{stepFieldErrorMessage(errors, 'span')}</FieldHint>
              ) : null}
              <div className="space-y-3">
                <Button type="button" variant="secondary" onClick={addDestination} className="w-full min-h-11 md:w-auto">
                  <Icon name="add" />
                  Adicionar destino
                </Button>
                <div
                  className="flex gap-2 rounded-md border border-amber-500/15 bg-amber-500/[0.05] px-2.5 py-2 text-xs leading-snug text-amber-900/80 dark:border-amber-400/15 dark:bg-amber-400/[0.05] dark:text-amber-100/80"
                  role="note"
                >
                  <Icon
                    name="warning"
                    className="mt-0.5 shrink-0 text-sm text-amber-600/80 dark:text-amber-300/80"
                    aria-hidden
                  />
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">Atenção:</span> Se a viagem tiver mais de um
                      destino, adicione todos aqui nesta etapa — com datas em sequência. Você pode
                      voltar depois para editar, mas é mais simples deixar tudo certo antes de
                      avançar.
                    </p>
                    <p className="text-amber-800/65 dark:text-amber-100/55">
                      Exemplo: Orlando e Nova York.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Locais de Estadia</h3>
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Você já tem uma estadia reservada? Se sim, informe os detalhes aqui. Não tem
                  reserva ainda? Pule. Com o plano completo você adiciona a estadia depois, no
                  roteiro.
                </p>
                <p className="text-sm text-text-secondary">
                  Adicione quantas hospedagens quiser por destino, com datas próprias. Se as datas
                  se cruzarem, a hospedagem mais recente substitui a anterior nos dias em comum.
                </p>
              </div>
              {formData.destinations.map((dest) => (
                <AccommodationDestinationGroup
                  key={dest.id}
                  dest={dest}
                  destAccs={getAccommodationsForDestination(formData.accommodations, dest.id)}
                  destinations={formData.destinations}
                  disabled={loading}
                  fieldIdPrefix="planning"
                  onAdd={addAccommodation}
                  onChange={updateAccommodation}
                  onRemove={removeAccommodation}
                />
              ))}
              {previewAccommodationReplacements(
                (formData.accommodations || []).filter(accommodationHasContent),
              ).map((w) => (
                <p
                  key={w.message}
                  className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed bg-amber-500/10 rounded-xl px-3 py-2"
                  role="status"
                >
                  {w.message}
                </p>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Interesses e Preferências</h3>
              <div>
                <label className="block text-sm font-semibold mb-2">Interesses * (mín. 1)</label>
                <div
                  className={`newtrip-choice-chips flex flex-wrap gap-2 max-w-full rounded-xl ${
                    stepFieldErrorMessage(errors, 'interests')
                      ? 'ring-2 ring-red-500/40 p-1'
                      : ''
                  }`}
                >
                  {INTERESTS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('interests', slug)}
                      className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
                        formData.interests.includes(slug)
                          ? 'bg-primary text-foreground'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <FieldHint>{stepFieldErrorMessage(errors, 'interests')}</FieldHint>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Descrição da viagem (opcional)</label>
                <textarea
                  value={formData.tripDescription}
                  onChange={(e) => updateField('tripDescription', e.target.value.slice(0, 2000))}
                  placeholder="Descreva como você imagina sua viagem ideal..."
                  rows={3}
                  maxLength={2000}
                  className={`${fieldInputClass} resize-none`}
                />
                <span className="text-xs text-text-secondary">{formData.tripDescription.length}/2000</span>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Estilo do roteiro</label>
                <div className="newtrip-choice-chips flex flex-wrap gap-2">
                  {ITINERARY_STYLES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('itineraryStyle', value)}
                      className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-xl text-sm font-medium transition-all ${
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
                <label className="block text-sm font-semibold mb-2">Viajantes *</label>
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs leading-none text-text-secondary">Adultos</span>
                    <input
                      type="number"
                      min={1}
                      aria-label="Adultos"
                      aria-invalid={stepFieldErrorMessage(errors, 'adults') ? 'true' : undefined}
                      value={formData.travelers.adults}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateField('travelers', {
                          ...formData.travelers,
                          adults: raw === '' ? '' : Math.max(1, parseInt(raw, 10) || 1),
                        })
                      }}
                      onBlur={() => {
                        if (formData.travelers.adults === '' || Number(formData.travelers.adults) < 1) {
                          updateField('travelers', { ...formData.travelers, adults: 1 })
                        }
                      }}
                      className={`box-border h-11 w-20 rounded-xl border px-2 text-center text-base tabular-nums bg-background-light dark:bg-background-dark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                        stepFieldErrorMessage(errors, 'adults')
                          ? 'border-red-500/60 dark:border-red-400/50'
                          : 'border-border-light dark:border-border-dark'
                      }`}
                    />
                    <FieldHint>{stepFieldErrorMessage(errors, 'adults')}</FieldHint>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs leading-none text-text-secondary">Crianças</span>
                    <input
                      type="number"
                      min={0}
                      aria-label="Crianças"
                      value={formData.travelers.children}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateField('travelers', {
                          ...formData.travelers,
                          children: raw === '' ? '' : Math.max(0, parseInt(raw, 10) || 0),
                        })
                      }}
                      onBlur={() => {
                        if (formData.travelers.children === '' || Number(formData.travelers.children) < 0) {
                          updateField('travelers', { ...formData.travelers, children: 0 })
                        }
                      }}
                      className="box-border h-11 w-20 rounded-xl border border-border-light bg-background-light px-2 text-center text-base tabular-nums dark:border-border-dark dark:bg-background-dark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                <div className="newtrip-choice-chips flex flex-wrap gap-2 max-w-full">
                  {AVOID_OPTIONS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('avoidPreferences', slug)}
                      className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
                        formData.avoidPreferences.includes(slug)
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.avoidCustom}
                  onChange={(e) => updateField('avoidCustom', e.target.value)}
                  placeholder="Outro (custom)"
                  className={`mt-2 ${fieldInputClass}`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Coisas a priorizar (opcional)</label>
                <div className="newtrip-choice-chips flex flex-wrap gap-2 max-w-full">
                  {PRIORITIZE_OPTIONS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleMulti('prioritizePreferences', slug)}
                      className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
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
                  className={`mt-2 ${fieldInputClass}`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <label className="block text-sm font-semibold mb-2">Orçamento (opcional)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.budget}
                    onChange={(e) => updateField('budget', e.target.value)}
                    placeholder="0"
                    className={fieldInputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-semibold mb-2">Moeda</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => updateField('currency', e.target.value)}
                    className={fieldInputClass}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="hidden md:flex items-center justify-between mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 1}>
              Voltar
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={handleNextClick}>
                {skipStay ? 'Pular' : 'Próximo'}
              </Button>
            ) : (
              <Button type="button" disabled={loading} onClick={handleCreateTripClick}>
                {loading ? 'Criando...' : 'Criar Viagem'}
              </Button>
            )}
          </div>
        </form>
      <div className="mobile-task-cta-spacer md:hidden" aria-hidden />
      <div className="mobile-task-cta md:hidden">{wizardNav}</div>
      <AccommodationReplaceConfirmDialog
        open={Boolean(pendingStayAdvance)}
        messages={pendingStayAdvance?.warningMessages || []}
        confirmLabel="Confirmar e continuar"
        onCancel={() => setPendingStayAdvance(null)}
        onConfirm={() => {
          if (!pendingStayAdvance) return
          applyStayStepAndAdvance(
            pendingStayAdvance.resolved,
            pendingStayAdvance.warningMessages.map((message) => ({ message })),
          )
        }}
      />
    </div>
  )
}
