import { CellKind, type CellView } from '../domain/rooms'

// Soft tinted bubble per state. Supports the text, never replaces it.
const KIND_CLASSES: Record<CellKind, string> = {
  [CellKind.NotBooked]: 'border border-dashed border-line text-muted',
  [CellKind.Open]: 'bg-open-soft text-open-ink',
  [CellKind.Mine]: 'bg-mine-soft font-medium text-mine-ink',
  [CellKind.Full]: 'bg-sunk text-ink',
  [CellKind.Quiet]: 'bg-sunk text-ink',
}

// Status dot beside the text: green free, indigo yours, grey taken. None when not booked.
const DOT_CLASSES: Record<CellKind, string | null> = {
  [CellKind.NotBooked]: null,
  [CellKind.Open]: 'bg-open-dot',
  [CellKind.Mine]: 'bg-mine-dot',
  [CellKind.Full]: 'bg-taken-dot',
  [CellKind.Quiet]: 'bg-taken-dot',
}

export function isPast(view: CellView): boolean {
  return view.kind !== CellKind.NotBooked && view.past
}

// Past sessions are dimmed; screen readers get a text note instead (see PastNote).
export function cellClasses(view: CellView): string {
  return `${KIND_CLASSES[view.kind]}${isPast(view) ? ' opacity-60' : ''}`
}

export function dotClass(view: CellView): string | null {
  return DOT_CLASSES[view.kind]
}
