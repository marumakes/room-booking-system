import { useLocation } from 'react-router'

// Shows the current URL so tests can assert on redirects and ?week= changes.
export function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname + location.search}</span>
}
