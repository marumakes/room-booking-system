// Why a data load or save failed, in terms the UI can explain.
export const DataFailure = {
  Network: 'network',
  Unknown: 'unknown',
} as const
export type DataFailure = (typeof DataFailure)[keyof typeof DataFailure]
