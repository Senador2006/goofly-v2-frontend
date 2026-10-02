import { Link } from 'react-router-dom'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { FinalizeItineraryOverlay } from './FinalizeItineraryOverlay'

export function ItineraryPageStates({ loading, trip, error, finalizingTdv }) {
  if (loading && !trip) {
    return (
      <>
        {finalizingTdv ? null : <LoadingSpinner />}
        <FinalizeItineraryOverlay open={finalizingTdv} />
      </>
    )
  }
  if (error || !trip) {
    return (
      <>
        <div className="p-4">
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">
            {error || 'Viagem não encontrada'}
          </div>
          <Link to="/trips">
            <Button variant="secondary" className="mt-4">
              Voltar
            </Button>
          </Link>
        </div>
        <FinalizeItineraryOverlay open={finalizingTdv} />
      </>
    )
  }
  return null
}
