import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'

/** Where the app opens. Holds the place of the weekly overview dashboard until it is built. */
export function OverviewPage() {
  return (
    <Card className="h-full min-h-0 w-full">
      <CardHeader title="Overview" description="Your week at a glance will live here." />
      <div className="px-4">
        <p className="mb-4 max-w-prose text-sm text-white/60">
          Until then, Tasks lists everything in the order the scheduler would tackle it.
        </p>
        <Button asChild size="sm" variant="secondary"><Link to="/tasks">Open Tasks</Link></Button>
      </div>
    </Card>
  )
}
