import { AccommodationDestinationGroup } from '../AccommodationStayForm'
import {
  accommodationHasContent,
  getAccommodationsForDestination,
} from '../../../utils/accommodationForm'
import { previewAccommodationReplacements } from '../../../utils/accommodationStayContract'

export function NewTripStepStay({
  formData,
  loading,
  mapsReady,
  addAccommodation,
  updateAccommodation,
  removeAccommodation,
}) {
  return (
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
          requirePlaceSuggestion={mapsReady}
          onAdd={addAccommodation}
          onChange={updateAccommodation}
          onRemove={removeAccommodation}
        />
      ))}
      {previewAccommodationReplacements(
        (formData.accommodations || []).filter(accommodationHasContent),
      ).map((warning) => (
        <p
          key={warning.message}
          className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed bg-amber-500/10 rounded-xl px-3 py-2"
          role="status"
        >
          {warning.message}
        </p>
      ))}
    </div>
  )
}
