// A message shown above the rooms after a claim or release.
export const NoticeKind = {
  Success: 'success',
  Error: 'error',
} as const
export type NoticeKind = (typeof NoticeKind)[keyof typeof NoticeKind]

export type Notice = {
  kind: NoticeKind
  text: string
  // Offer "Add to calendar" after a successful claim.
  offerCalendar?: boolean
}
