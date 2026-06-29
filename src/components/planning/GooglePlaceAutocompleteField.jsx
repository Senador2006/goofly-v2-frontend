import { useEffect, useRef } from 'react'
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

/** Tokens alinhados a `tailwind.config.js` — aplicados no Web Component para sync em runtime. */
const GOOFLY_AC_THEME = {
  light: {
    colorScheme: 'light',
    backgroundColor: '#ffffff',
    vars: {
      '--gmp-mat-color-surface': '#ffffff',
      '--gmp-mat-color-on-surface': '#111111',
      '--gmp-mat-color-on-surface-variant': '#6b6b6b',
      '--gmp-mat-color-outline-decorative': '#e5e5e5',
      '--gmp-mat-color-primary': '#fec641',
      '--gmp-mat-color-neutral-container': '#ffffff',
      '--gmp-mat-color-on-neutral-container': '#111111',
      '--gmp-mat-color-secondary-container': '#f5f5f5',
    },
  },
  dark: {
    colorScheme: 'dark',
    backgroundColor: '#1a1a1a',
    vars: {
      '--gmp-mat-color-surface': '#1a1a1a',
      '--gmp-mat-color-on-surface': 'rgba(249, 250, 251, 0.96)',
      '--gmp-mat-color-on-surface-variant': 'rgba(180, 180, 180, 0.95)',
      '--gmp-mat-color-outline-decorative': '#2a2a2a',
      '--gmp-mat-color-primary': '#fec641',
      '--gmp-mat-color-neutral-container': '#232323',
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
  for (const [key, value] of Object.entries(theme.vars)) {
    ac.style.setProperty(key, value)
  }
}

const DEFAULT_AC_CLASSNAME =
  'goofly-google-place-ac-frame relative z-[42] w-full min-h-[3.125rem] overflow-visible rounded-xl border border-border-light dark:border-border-dark'

/**
 * Place Autocomplete (novo): `PlaceAutocompleteElement` (`gmp-place-autocomplete`).
 * @see {@link https://developers.google.com/maps/documentation/javascript/place-autocomplete-new}
 *
 * @param {{
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
 * }} props
 */
export function GooglePlaceAutocompleteField({
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

  /* Monta uma única vez por `id`; evita remover o Web Component a cada render do pai. */
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
    // valor inicial apenas na montagem; depois usa o efeito de sync
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
