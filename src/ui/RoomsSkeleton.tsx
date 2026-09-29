import { cardClass } from './Screen'

// How many placeholder room tiles to show while loading: about one screen's worth.
const PLACEHOLDER_ROOMS = 6

// A grey block standing in for content. Pulses gently, unless the device asks for less motion.
function Bone({ className }: { className: string }) {
  return <div className={`rounded-full bg-track motion-safe:animate-pulse ${className}`} />
}

// Grey placeholder shapes in the layout of the rooms screen, shown while rooms load, so the page
// doesn't jump when they arrive. Screen readers hear "Loading rooms…" instead.
export function RoomsSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading rooms…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <Bone className="h-8 w-40" />
            <Bone className="h-4 w-72 max-w-full" />
          </div>
          <Bone className="h-11 w-52" />
        </div>

        <div className={cardClass}>
          <Bone className="h-4 w-36" />
          <Bone className="mt-3 h-3 w-52" />
        </div>

        <div className={cardClass}>
          <div className="mx-auto flex w-40 flex-col items-center gap-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-6 w-36" />
          </div>
          <div className="mt-6 grid gap-2.5 md:grid-cols-2">
            {Array.from({ length: PLACEHOLDER_ROOMS }, (_, i) => (
              <div key={i} className="rounded-2xl bg-sunk p-4">
                <Bone className="h-4 w-28" />
                <Bone className="mt-3 h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
