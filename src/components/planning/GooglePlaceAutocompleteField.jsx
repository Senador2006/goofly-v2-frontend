import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { useTheme } from '../../context/ThemeContext'
import { ensurePlacesLibrary } from '../../services/googleMapsPlacesLoader'

/**
 * @typedef {{
 *   city?: string,
 *   country?: string,
 *   name?: string,
 *   formattedAddress?: string,
 *   coordinates?: { latitude: number, longitude: number },
 * }} PlaceResolvedPatch
 */

/**
 * @typedef {{
 *   id: string,
 *   placeholder?: string,
 *   disabled?: boolean,
 *   value?: string,
 *   onDraftChange?: (text: string) => void,
 *   onBlur?: () => void,
 *   onResolved: (patch: PlaceResolvedPatch) => void,
 *   includedRegionCodes?: string[],
 *   includedPrimaryTypes?: string[],
 *   resultKind?: 'city' | 'place',
 *   className?: string,
 *   inputClassName?: string,
 * }} GooglePlaceAutocompleteFieldProps
 */

/**
 * @param {google.maps.places.AddressComponent | undefined} ac
 */
function longText(ac) {
  if (!ac) return ''
  return String(ac.longText ?? ac.long_name ?? '').trim()
}

/**
 * @param {google.maps.places.Place} place
 * @returns {{ city: string, country: string }}
 */
function cityCountryFromPlace(place) {
  const parts = place.addressComponents ?? []
  let locality = ''
  let adm2 = ''
  let adm1 = ''
  let country = ''

  for (const c of parts) {
    const types = /** @type {string[]} */ (c.types ?? [])
    if (types.includes('locality')) locality = longText(c)
    if (types.includes('administrative_area_level_2')) adm2 = longText(c)
    if (types.includes('administrative_area_level_1')) adm1 = longText(c)
    if (types.includes('country')) country = longText(c)
  }

  let city =
    locality ||
    adm2 ||
    adm1 ||
    (place.displayName ? String(place.displayName).split(',')[0].trim() : '')

  if (!city && place.formattedAddress) {
    const head = String(place.formattedAddress).split(',')[0].trim()
    if (head) city = head
  }

  return { city, country }
}

/**
 * @param {google.maps.places.Place | null | undefined} place
 * @returns {{ latitude: number, longitude: number } | null}
 */
function coordinatesFromPlace(place) {
  const loc = place?.location
  if (!loc) return null
  if (typeof loc.lat === 'function' && typeof loc.lng === 'function') {
    return { latitude: loc.lat(), longitude: loc.lng() }
  }
  const lit = /** @type {{ lat?: number; lng?: number }} */ (loc)
  if (typeof lit.lat === 'number' && typeof lit.lng === 'number') {
    return { latitude: lit.lat, longitude: lit.lng }
  }
  return null
}

/** Coleção de tipos da Places API (novo) — apenas cidades. */
const CITY_PRIMARY_TYPES = ['(cities)']

/**
 * @param {'city' | 'place'} resultKind
 * @param {string[] | undefined} explicit
 * @returns {string[] | null}
 */
function resolveIncludedPrimaryTypes(resultKind, explicit) {
  if (explicit?.length) return [...explicit]
  if (resultKind === 'city') return [...CITY_PRIMARY_TYPES]
  return null
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function formattableToString(text) {
  if (!text) return ''
  if (typeof text === 'string') return text
  if (typeof text.toString === 'function') return String(text.toString())
  if (typeof /** @type {{ text?: string }} */ (text).text === 'string') {
    return /** @type {{ text: string }} */ (text).text
  }
  return ''
}

/** Tokens alinhados a `tailwind.config.js` — aplicados no Web Component para sync em runtime. */
const GOOFLY_AC_THEME = {
  light: {
    colorScheme: 'light',
    backgroundColor: '#F5F5F5',
    vars: {
      '--gmp-mat-color-surface': '#F5F5F5',
      '--gmp-mat-color-on-surface': '#111111',
      '--gmp-mat-color-on-surface-variant': '#6b6b6b',
      '--gmp-mat-color-outline-decorative': 'transparent',
      '--gmp-mat-color-primary': '#fec641',
      '--gmp-mat-color-neutral-container': '#F5F5F5',
      '--gmp-mat-color-on-neutral-container': '#111111',
      '--gmp-mat-color-secondary-container': '#ffffff',
    },
  },
  dark: {
    colorScheme: 'dark',
    backgroundColor: '#111111',
    vars: {
      '--gmp-mat-color-surface': '#111111',
      '--gmp-mat-color-on-surface': 'rgba(249, 250, 251, 0.96)',
      '--gmp-mat-color-on-surface-variant': 'rgba(180, 180, 180, 0.95)',
      '--gmp-mat-color-outline-decorative': 'transparent',
      '--gmp-mat-color-primary': '#fec641',
      '--gmp-mat-color-neutral-container': '#111111',
      '--gmp-mat-color-on-neutral-container': 'rgba(249, 250, 251, 0.96)',
      '--gmp-mat-color-secondary-container': '#161616',
    },
  },
}

/**
 * @param {google.maps.places.PlaceAutocompleteElement} ac
 * @param {boolean} isDark
 */
function applyGooglePlaceAcTheme(ac, isDark) {
  const theme = isDark ? GOOFLY_AC_THEME.dark : GOOFLY_AC_THEME.light
  ac.style.colorScheme = theme.colorScheme
  ac.style.backgroundColor = theme.backgroundColor
  ac.style.borderRadius = '3rem'
  for (const [key, value] of Object.entries(theme.vars)) {
    ac.style.setProperty(key, value)
  }
}

/** Tailwind `md` = 768px — abaixo disso usamos o balão custom (evita overlay fullscreen do Google). */
const MOBILE_MQ = '(max-width: 767px)'

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

const DEFAULT_AC_CLASSNAME =
  'goofly-google-place-ac-frame relative z-[42] w-full min-w-0 min-h-[3.125rem] overflow-visible rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark'

const DEFAULT_INPUT_CLASSNAME =
  'w-full min-w-0 px-4 py-3 text-base rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-[#1c1c0d] dark:text-white placeholder:text-text-secondary'

const DEBOUNCE_MS = 220

/**
 * Desktop: `PlaceAutocompleteElement` (balão nativo do Google).
 * @param {GooglePlaceAutocompleteFieldProps} props
 */
function GooglePlaceAutocompleteDesktop({
  id,
  placeholder = 'Cidade ou destino…',
  disabled = false,
  value = '',
  onDraftChange,
  onBlur,
  onResolved,
  includedRegionCodes,
  includedPrimaryTypes,
  resultKind = 'city',
  className = DEFAULT_AC_CLASSNAME,
}) {
  const { isDark } = useTheme()
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const acRef = useRef(/** @type {google.maps.places.PlaceAutocompleteElement | null} */ (null))
  const syncingRef = useRef(false)
  const onResolvedRef = useRef(onResolved)
  const onDraftRef = useRef(onDraftChange)
  const onBlurRef = useRef(onBlur)
  const latestPropsRef = useRef({
    value,
    placeholder,
    disabled,
    includedRegionCodes,
    includedPrimaryTypes,
    resultKind,
  })
  latestPropsRef.current = {
    value,
    placeholder,
    disabled,
    includedRegionCodes,
    includedPrimaryTypes,
    resultKind,
  }

  useEffect(() => {
    onResolvedRef.current = onResolved
  }, [onResolved])

  useEffect(() => {
    onDraftRef.current = onDraftChange
  }, [onDraftChange])

  useEffect(() => {
    onBlurRef.current = onBlur
  }, [onBlur])

  useEffect(() => {
    let cancelled = false
    /** @type {google.maps.places.PlaceAutocompleteElement | null} */
    let ac = null

    /** @param {Event} evt */
    const onSelect = async (evt) => {
      try {
        const e = /** @type {google.maps.places.PlacePredictionSelectEvent} */ (evt)
        const prediction = e.placePrediction
        if (!prediction) return

        const place = prediction.toPlace()
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        })

        /** @type {PlaceResolvedPatch} */
        const patch = {}
        const { city, country } = cityCountryFromPlace(place)
        const displayName = String(place.displayName ?? '').trim()
        const formattedAddress = String(place.formattedAddress ?? '').trim()
        if (city) patch.city = city
        if (country) patch.country = country
        if (displayName) patch.name = displayName
        if (formattedAddress) patch.formattedAddress = formattedAddress
        const coords = coordinatesFromPlace(place)
        if (coords) patch.coordinates = coords

        onResolvedRef.current?.(patch)

        syncingRef.current = true
        const kind = latestPropsRef.current.resultKind
        const composed = kind === 'place' ? displayName || city || '' : city || ''
        if (composed && ac) ac.value = composed
        requestAnimationFrame(() => {
          syncingRef.current = false
        })
      } catch {
        /* degradação: formulário manual */
      }
    }

    /** @type {EventListener} */
    const onInputInternal = () => {
      if (syncingRef.current || !ac) return
      onDraftRef.current?.(ac.value || '')
    }

    /** @type {EventListener} */
    const onBlurInternal = () => {
      onBlurRef.current?.()
    }

    ;(async () => {
      try {
        const placesMod =
          /** @type {{ PlaceAutocompleteElement: typeof google.maps.places.PlaceAutocompleteElement }} */
          await ensurePlacesLibrary()
        if (cancelled || !wrapRef.current) return

        const snap = latestPropsRef.current
        const primaryTypes = resolveIncludedPrimaryTypes(snap.resultKind, snap.includedPrimaryTypes)

        ac = new placesMod.PlaceAutocompleteElement({
          ...(primaryTypes ? { includedPrimaryTypes: primaryTypes } : {}),
        })

        ac.id = id
        ac.placeholder = snap.placeholder ?? ''
        ac.disabled = Boolean(snap.disabled)
        ac.requestedLanguage = 'pt-BR'

        if (snap.includedRegionCodes?.length) ac.includedRegionCodes = [...snap.includedRegionCodes]
        else ac.includedRegionCodes = null

        ac.includedPrimaryTypes = primaryTypes ? [...primaryTypes] : null

        syncingRef.current = true
        if (typeof snap.value === 'string' && snap.value.trim()) ac.value = snap.value.trim()
        requestAnimationFrame(() => {
          syncingRef.current = false
        })

        ac.addEventListener('gmp-select', onSelect)
        ac.addEventListener('input', onInputInternal)
        ac.addEventListener('blur', onBlurInternal)

        wrapRef.current.replaceChildren(ac)
        acRef.current = ac
        applyGooglePlaceAcTheme(ac, isDarkRef.current)
      } catch {
        if (!cancelled && wrapRef.current) wrapRef.current.replaceChildren()
        acRef.current = null
      }
    })()

    return () => {
      cancelled = true
      if (ac) {
        ac.removeEventListener('gmp-select', onSelect)
        ac.removeEventListener('input', onInputInternal)
        ac.removeEventListener('blur', onBlurInternal)
      }
      acRef.current = null
      wrapRef.current?.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: id identifica cada destino
  }, [id])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    applyGooglePlaceAcTheme(ac, isDark)
  }, [isDark])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    if (includedRegionCodes?.length) ac.includedRegionCodes = [...includedRegionCodes]
    else ac.includedRegionCodes = null
  }, [includedRegionCodes])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    const types = resolveIncludedPrimaryTypes(resultKind, includedPrimaryTypes)
    ac.includedPrimaryTypes = types ? [...types] : null
  }, [resultKind, includedPrimaryTypes])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    ac.placeholder = placeholder || ''
  }, [placeholder])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    ac.disabled = Boolean(disabled)
  }, [disabled])

  useEffect(() => {
    const ac = acRef.current
    if (!ac) return
    const next = typeof value === 'string' ? value : ''
    if ((ac.value || '') === next) return
    syncingRef.current = true
    ac.value = next
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }, [value])

  return <div ref={wrapRef} className={className} />
}

/**
 * Mobile: Autocomplete Data API + balão próprio (sem overlay fullscreen do Google).
 * @param {GooglePlaceAutocompleteFieldProps} props
 */
function GooglePlaceAutocompleteMobile({
  id,
  placeholder = 'Cidade ou destino…',
  disabled = false,
  value = '',
  onDraftChange,
  onBlur,
  onResolved,
  includedRegionCodes,
  includedPrimaryTypes,
  resultKind = 'city',
  inputClassName = DEFAULT_INPUT_CLASSNAME,
}) {
  const listboxId = useId()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const popoverRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const blurTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const debounceRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const requestIdRef = useRef(0)
  /** Distingue tap de arraste no balão. */
  const touchStartYRef = useRef(0)
  const touchMovedRef = useRef(false)
  const sessionTokenRef = useRef(/** @type {google.maps.places.AutocompleteSessionToken | null} */ (null))
  const placesModRef = useRef(/** @type {null | {
    AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion,
    AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken,
  }} */ (null))

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  /** @type {[{ mainText: string, secondaryText: string, placePrediction: google.maps.places.PlacePrediction }[], Function]} */
  const [items, setItems] = useState(
    /** @type {{ mainText: string, secondaryText: string, placePrediction: google.maps.places.PlacePrediction }[]} */ ([]),
  )
  const [popoverStyle, setPopoverStyle] = useState(/** @type {Record<string, string | number>} */ ({}))

  const onResolvedRef = useRef(onResolved)
  const onDraftRef = useRef(onDraftChange)
  const onBlurRef = useRef(onBlur)
  onResolvedRef.current = onResolved
  onDraftRef.current = onDraftChange
  onBlurRef.current = onBlur

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mod =
          /** @type {{
           *   AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion,
           *   AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken,
           * }} */
          (await ensurePlacesLibrary())
        if (!cancelled) placesModRef.current = mod
      } catch {
        /* sem chave / falha de carga */
      }
    })()
    return () => {
      cancelled = true
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const ensureSessionToken = () => {
    const mod = placesModRef.current
    if (!mod) return null
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new mod.AutocompleteSessionToken()
    }
    return sessionTokenRef.current
  }

  const refreshSessionToken = () => {
    const mod = placesModRef.current
    sessionTokenRef.current = mod ? new mod.AutocompleteSessionToken() : null
  }

  const updatePopoverPosition = () => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    const gap = 4
    const maxHeight = Math.min(256, window.innerHeight * 0.5)
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow
    const height = Math.min(maxHeight, placeAbove ? spaceAbove : Math.max(spaceBelow, 120))

    setPopoverStyle({
      position: 'fixed',
      left: Math.max(8, rect.left),
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight: height,
      zIndex: 80,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePopoverPosition()
    /** Ignora scroll interno do balão — senão o setState mata o gesto de arrastar. */
    const onReposition = (evt) => {
      const target = /** @type {Event} */ (evt)?.target
      if (target instanceof Node && popoverRef.current?.contains(target)) return
      updatePopoverPosition()
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, items.length])

  /**
   * @param {string} input
   */
  const fetchSuggestions = async (input) => {
    const query = input.trim()
    const requestId = ++requestIdRef.current
    if (!query) {
      setItems([])
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    try {
      if (!placesModRef.current) {
        placesModRef.current =
          /** @type {{
           *   AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion,
           *   AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken,
           * }} */ (await ensurePlacesLibrary())
      }
      const mod = placesModRef.current
      if (!mod) return

      const primaryTypes = resolveIncludedPrimaryTypes(resultKind, includedPrimaryTypes)
      const sessionToken = ensureSessionToken()

      /** @type {google.maps.places.AutocompleteRequest} */
      const request = {
        input: query,
        language: 'pt-BR',
        region: 'BR',
        ...(sessionToken ? { sessionToken } : {}),
        ...(primaryTypes ? { includedPrimaryTypes: primaryTypes } : {}),
        ...(includedRegionCodes?.length ? { includedRegionCodes: [...includedRegionCodes] } : {}),
      }

      const { suggestions } = await mod.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
      if (requestId !== requestIdRef.current) return

      const next = []
      for (const s of suggestions ?? []) {
        const placePrediction = s.placePrediction
        if (!placePrediction) continue
        next.push({
          placePrediction,
          mainText:
            formattableToString(placePrediction.mainText) ||
            formattableToString(placePrediction.text),
          secondaryText: formattableToString(placePrediction.secondaryText),
        })
      }

      setItems(next)
      setOpen(next.length > 0)
      setActiveIndex(next.length > 0 ? 0 : -1)
    } catch {
      if (requestId !== requestIdRef.current) return
      setItems([])
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  /**
   * @param {string} next
   */
  const handleInputChange = (next) => {
    onDraftRef.current?.(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(next)
    }, DEBOUNCE_MS)
  }

  /**
   * @param {google.maps.places.PlacePrediction} placePrediction
   */
  const selectPrediction = async (placePrediction) => {
    setOpen(false)
    setItems([])
    setActiveIndex(-1)
    try {
      const place = placePrediction.toPlace()
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      })

      /** @type {PlaceResolvedPatch} */
      const patch = {}
      const { city, country } = cityCountryFromPlace(place)
      const displayName = String(place.displayName ?? '').trim()
      const formattedAddress = String(place.formattedAddress ?? '').trim()
      if (city) patch.city = city
      if (country) patch.country = country
      if (displayName) patch.name = displayName
      if (formattedAddress) patch.formattedAddress = formattedAddress
      const coords = coordinatesFromPlace(place)
      if (coords) patch.coordinates = coords

      const composed = resultKind === 'place' ? displayName || city || '' : city || ''
      if (composed) onDraftRef.current?.(composed)
      onResolvedRef.current?.(patch)
    } catch {
      /* degradação */
    } finally {
      refreshSessionToken()
    }
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLInputElement>} e
   */
  const handleKeyDown = (e) => {
    if (!open || items.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault()
        void selectPrediction(items[activeIndex].placePrediction)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      setOpen(false)
      onBlurRef.current?.()
    }, 160)
  }

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    if (items.length > 0 && String(value || '').trim()) setOpen(true)
  }

  useEffect(() => {
    const onDocPointer = (evt) => {
      const target = evt.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [])

  const popover =
    open && items.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="goofly-place-ac-popover flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] dark:border-border-dark dark:bg-[#161616]"
            role="presentation"
            onPointerDown={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
            }}
          >
            <ul
              id={listboxId}
              role="listbox"
              className="goofly-place-ac-list min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y py-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {items.map((item, index) => {
                const active = index === activeIndex
                return (
                  <li key={`${item.mainText}-${index}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      id={`${listboxId}-opt-${index}`}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors touch-pan-y ${
                        active
                          ? 'bg-primary/20 text-[#1c1c0d] dark:bg-primary/15 dark:text-white'
                          : 'text-[#1c1c0d] hover:bg-background-light dark:text-zinc-100 dark:hover:bg-white/[0.06]'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onTouchStart={(e) => {
                        touchMovedRef.current = false
                        touchStartYRef.current = e.touches[0]?.clientY ?? 0
                      }}
                      onTouchMove={(e) => {
                        const y = e.touches[0]?.clientY ?? 0
                        if (Math.abs(y - touchStartYRef.current) > 10) {
                          touchMovedRef.current = true
                        }
                      }}
                      onClick={() => {
                        if (touchMovedRef.current) return
                        void selectPrediction(item.placePrediction)
                      }}
                    >
                      <Icon
                        name="location_on"
                        className="mt-0.5 shrink-0 text-[1.25rem] text-text-secondary dark:text-zinc-400 pointer-events-none"
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 pointer-events-none">
                        <span className="text-sm font-semibold leading-snug">{item.mainText}</span>
                        {item.secondaryText ? (
                          <span className="text-xs text-text-secondary dark:text-zinc-400 leading-snug">
                            {item.secondaryText}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex shrink-0 items-center justify-end border-t border-border-light px-3 py-1.5 dark:border-border-dark">
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                alt="Powered by Google"
                className="h-3.5 w-auto dark:hidden"
                width={104}
                height={14}
                decoding="async"
              />
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-non-white3.png"
                alt="Powered by Google"
                className="hidden h-3.5 w-auto dark:block"
                width={104}
                height={14}
                decoding="async"
              />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="goofly-place-ac relative z-[42] w-full min-w-0">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={inputClassName}
      />
      {popover}
    </div>
  )
}

/**
 * Desktop (<768px): widget Google nativo.
 * Mobile: balão customizado (sem tela preta fullscreen).
 *
 * @param {GooglePlaceAutocompleteFieldProps} props
 */
export function GooglePlaceAutocompleteField(props) {
  const isMobile = useIsMobileViewport()
  if (isMobile) {
    return (
      <GooglePlaceAutocompleteMobile
        key={`mobile-${props.id}`}
        {...props}
        inputClassName={props.inputClassName ?? DEFAULT_INPUT_CLASSNAME}
      />
    )
  }
  return <GooglePlaceAutocompleteDesktop key={`desktop-${props.id}`} {...props} />
}
