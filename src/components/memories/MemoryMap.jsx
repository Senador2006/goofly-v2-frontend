import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'

/**
 * Mapa real para RF08.3 — substitui o placeholder de `left:%` por tiles OSM.
 *
 * Decisões:
 * - **OpenStreetMap**: tiles públicos, sem chave de API. Atribuição respeitada
 *   no `TileLayer`.
 * - **divIcon**: evita o bug clássico do Leaflet com bundlers (ícone padrão
 *   referencia URLs relativas a `leaflet/dist/images/*` que somem em build).
 *   Como bônus, o marcador herda o `bg-primary` do design system.
 * - **fitBounds**: o `<FitBoundsToPoints>` interno reage a mudanças de
 *   `points` e zoom até caber todas as memórias. Sem pontos, mostra o
 *   mundo (`[0,0]` zoom 2).
 *
 * Coordenadas aceitas (defensivo — backend hoje devolve `coordinates` cru):
 *   { latitude, longitude } | { lat, lng } | { lat, lon } | [lat, lng]
 */

function readLatLng(p) {
  const c = p?.coordinates ?? p?.location ?? p
  if (!c) return null
  if (Array.isArray(c) && c.length >= 2) {
    const [lat, lng] = c
    return Number.isFinite(lat) && Number.isFinite(lng) ? [Number(lat), Number(lng)] : null
  }
  const lat = c.latitude ?? c.lat
  const lng = c.longitude ?? c.lng ?? c.lon
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  return [Number(lat), Number(lng)]
}

const markerIcon = L.divIcon({
  className: 'goofly-memory-marker',
  // Tamanho 18px, anel para destacar sobre tiles claros e escuros.
  html:
    '<div style="' +
    'width:14px;height:14px;border-radius:9999px;' +
    'background:#FEC107;' +
    'box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(254,193,7,0.5);' +
    '"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -8],
})

function FitBoundsToPoints({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (!coords || coords.length === 0) {
      map.setView([20, 0], 2)
      return
    }
    if (coords.length === 1) {
      map.setView(coords[0], 6)
      return
    }
    const bounds = L.latLngBounds(coords)
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 8 })
  }, [map, coords])
  return null
}

export function MemoryMap({ points = [], className = '', ariaLabel = 'Mapa de memórias' }) {
  const normalized = useMemo(() => {
    return points
      .map((p) => {
        const coords = readLatLng(p)
        if (!coords) return null
        return {
          id: p.id,
          tripId: p.trip_id ?? p.tripId,
          caption: p.caption,
          createdAt: p.created_at ?? p.createdAt,
          coords,
        }
      })
      .filter(Boolean)
  }, [points])

  const allCoords = useMemo(() => normalized.map((n) => n.coords), [normalized])

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-4 border-border-light dark:border-border-dark shadow-2xl ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {normalized.map((m) => (
          <Marker key={m.id || `${m.coords[0]},${m.coords[1]}`} position={m.coords} icon={markerIcon}>
            {(m.caption || m.createdAt) && (
              <Popup>
                {m.caption ? (
                  <p className="m-0 text-sm font-semibold text-[#1c1c0d]">{m.caption}</p>
                ) : null}
                {m.createdAt ? (
                  <p className="m-0 text-xs text-text-secondary">
                    {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                ) : null}
              </Popup>
            )}
          </Marker>
        ))}
        <FitBoundsToPoints coords={allCoords} />
      </MapContainer>
      {normalized.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div className="rounded-2xl bg-white/85 dark:bg-card-dark/85 backdrop-blur px-5 py-4 text-center border border-border-light dark:border-border-dark shadow-md">
            <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Sem memórias no mapa</p>
            <p className="text-xs text-text-secondary mt-1">
              Adicione fotos com localização para vê-las aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
