import 'driver.js/dist/driver.css'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { LandingHero } from '../components/landing/LandingHero'
import { LandingOffers } from '../components/landing/LandingOffers'
import { LandingBenefits } from '../components/landing/LandingBenefits'
import { LandingSteps } from '../components/landing/LandingSteps'
import { LandingPlans } from '../components/landing/LandingPlans'
import { LandingTestimonials } from '../components/landing/LandingTestimonials'
import { LandingFooter } from '../components/landing/LandingFooter'
import { LandingGuideButton } from '../components/landing/LandingGuideButton'
import { useFadeUp } from '../hooks/useFadeUp'
import { useSiteTour } from '../hooks/useSiteTour'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Landing() {
  useDocumentTitle('Goofly — Seu Roteiro Ideal', { exact: true })
  useFadeUp()
  const { startTour } = useSiteTour()

  return (
    <div className="landing-page min-h-screen bg-white text-foreground">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingOffers />
        <LandingBenefits />
        <LandingSteps />
        <LandingPlans />
        <LandingTestimonials />
      </main>
      <LandingFooter />
      <LandingGuideButton onStart={startTour} />
    </div>
  )
}
