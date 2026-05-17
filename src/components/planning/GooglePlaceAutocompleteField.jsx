import { useEffect, useRef } from 'react'
import { hasGoogleMapsApiKey, loadPlacesLibrary } from '../../services/googleMapsPlacesLoader.js'
import { summarizePlaceFromGoogleAutocomplete } from '../../utils/googlePlaceAutocompleteSummary.js'

/**
 * Campo destino usando o Place Autocomplete (novo — `PlaceAutocompleteElement`).
 * Ao escolher uma sugestão, chama `onResolved` com cidade, país e coordenadas (se existirem).
 *
 * Docs: https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
 *
 * Props: `id`, `placeholder`, `disabled`, `onResolved(patch)`
 */
export function GooglePlaceAutocompleteField({ id, placeholder, disabled, onResolved }) {
  const hostRef = useRef(null)
  const acRef = useRef(null)
  const onResolvedRef = useRef(onResolved)
  onResolvedRef.current = onResolved

  useEffect(() => {
    let ac
    /** @type {(() => void) | undefined} */
    let unsub
    let cancelled = false

    /** @type {((event: Event) => void) | undefined} */
    let selectHandler

    const run = async () => {
      if (!hasGoogleMapsApiKey() || !hostRef.current) return

      try {
        const places = await loadPlacesLibrary()
        if (cancelled || !hostRef.current || !places?.PlaceAutocompleteElement) return

        const PlaceAutocompleteElement = places.PlaceAutocompleteElement

        /** @see https://developers.google.com/maps/documentation/javascript/reference/places-widget */
        ac = new PlaceAutocompleteElement({
          placeholder: placeholder || '',
        })
        acRef.current = ac
        try {
          if ('disabled' in ac) ac.disabled = !!disabled
        } catch (_) {
          /* noop */
        }
        selectHandler = async (ev) => {
          const ce = /** @type {CustomEvent<{ placePrediction?: { toPlace?: () => Record<string, unknown> } }>} */ (
            /** @type {unknown} */ (ev)
          )
          const pred = ce?.placePrediction
          if (!pred || typeof pred.toPlace !== 'function') return
          const place = pred.toPlace()
          try {
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'],
            })
            const patch = summarizePlaceFromGoogleAutocomplete(place)
            if (patch.city || patch.country) onResolvedRef.current(patch)
          } catch (_) {
            /* Falha pontual do Place Details não bloqueia o formulário manual */
          }
        }

        ac.addEventListener('gmp-select', selectHandler)

        hostRef.current.replaceChildren(ac)

        unsub = () => {
          try {
            if (selectHandler && ac) ac.removeEventListener('gmp-select', selectHandler)
          } catch (_) {
            /* ignore */
          }
          ac?.remove()
          acRef.current = null
        }
      } catch (_) {
        /* Sem Google: deixamos o pai renderizar só o fallback */
      }
    }

    run()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [placeholder])

  useEffect(() => {
    const el = acRef.current
    if (!el || !('disabled' in el)) return
    try {
      el.disabled = !!disabled
    } catch (_) {
      /* noop */
    }
  }, [disabled])
  if (!hasGoogleMapsApiKey()) return null

  return (
    <div
      className={`planning-google-place-ac-host planning-google-place-ac-frame w-full rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark ring-1 ring-transparent focus-within:ring-primary/40 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-card-dark py-px px-[2px] ${
        disabled ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <div ref={hostRef} id={id} className="w-full [&_gmp-place-autocomplete]:block [&_gmp-place-autocomplete]:w-full" />
      <span id={`${id}-hint`} className="sr-only">
        Pesquisa por cidade ou destino — sugestões do Google Places. Após escolher, cidade e país são preenchidos.
      </span>
    </div>
  )
}
