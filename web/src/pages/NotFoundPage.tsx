import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <Button asChild className="mt-6">
        <Link to="/">Back to inventory</Link>
      </Button>
    </section>
  )
}
