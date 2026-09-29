export const BrandSize = {
  // Header bar.
  Small: 'small',
  // Sign-in screens.
  Large: 'large',
} as const
export type BrandSize = (typeof BrandSize)[keyof typeof BrandSize]
