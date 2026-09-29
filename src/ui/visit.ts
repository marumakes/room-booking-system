// Whether the signed-in user has just set up their account (first sign-in) or is coming back.
export const Visit = {
  First: 'first',
  Returning: 'returning',
} as const
export type Visit = (typeof Visit)[keyof typeof Visit]
