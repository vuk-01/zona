import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SpaceSearchProps = {
  defaultValue?: string
}

// Search pill + round filter button. Searching opens Explore with ?search=; filters live on Explore.
export function SpaceSearch({ defaultValue = '' }: SpaceSearchProps) {
  const navigate = useNavigate()
  const [value, setValue] = useState(defaultValue)

  return (
    <form
      role="search"
      className="flex w-full max-w-2xl items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const search = value.trim()
        navigate(search ? `/spaces?${new URLSearchParams({ search })}` : '/spaces')
      }}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search spaces"
          placeholder="Search spaces"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-12 rounded-full bg-muted pr-4 pl-12 focus-visible:ring-ring"
        />
      </div>
      <Button
        asChild
        variant="outline"
        size="icon"
        className="size-12 shrink-0 rounded-full bg-card shadow-none focus-visible:ring-ring"
      >
        <Link to="/spaces" aria-label="Filters">
          <SlidersHorizontal className="size-5" aria-hidden="true" />
        </Link>
      </Button>
    </form>
  )
}
