import { primaryButtonClass } from './Screen'
import { Sheet } from './Sheet'
import { Visit } from './visit'

// One step of the guide: a short bold lead, then the detail.
const STEPS = [
  ['Pick a day and a room.', 'Choose Monday or Thursday, then tap a green room to claim it.'],
  ['Share or quiet.', 'Share with one other host, or take a quiet room just for your group.'],
  ['Every week.', 'If a room is booked all term, you can claim every remaining week in one go.'],
  ['Changed your mind?', 'Tap your room (in indigo) to release it, so someone else can have it.'],
  ['Your sessions', 'lists everything you’ve claimed, and you can add it all to your calendar.'],
] as const

type WelcomeSheetProps = {
  name: string
  visit: Visit
  onClose: () => void
}

// How the app works. Greets new hosts after they pick a name; reopened any time from the account menu.
export function WelcomeSheet({ name, visit, onClose }: WelcomeSheetProps) {
  const title = visit === Visit.First ? `Welcome, ${name}` : 'How it works'

  return (
    <Sheet title={title} subtitle="Claiming a room takes a few seconds." onClose={onClose}>
      <ol className="space-y-3 text-sm leading-relaxed">
        {STEPS.map(([lead, detail], i) => (
          <li key={lead} className="flex gap-3">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-sunk text-xs font-semibold">
              {i + 1}
            </span>
            <span>
              <strong>{lead}</strong> {detail}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-2xl bg-mine-soft p-4 text-sm text-mine-ink">
        <strong>Please share where you can:</strong> there aren’t enough rooms for every host to have their own, so most
        rooms will have two hosts. Quiet rooms are there when one’s free, but the committee may ask you to share if rooms
        get tight.
      </p>
      <button type="button" className={primaryButtonClass} onClick={onClose}>
        Got it
      </button>
    </Sheet>
  )
}
