import { createContext, useContext } from 'react'
import type { AuthRepo } from '../domain/auth'
import type { ClaimsRepo } from '../domain/claims'
import type { FileSaver } from '../domain/files'
import type { HistoryRepo } from '../domain/history'
import type { ProfileRepo } from '../domain/profile'
import type { RoomsRepo } from '../domain/rooms'
import type { SpreadsheetWriter } from '../domain/spreadsheet'

export type Repos = {
  auth: AuthRepo
  profiles: ProfileRepo
  rooms: RoomsRepo
  claims: ClaimsRepo
  files: FileSaver
  history: HistoryRepo
  spreadsheets: SpreadsheetWriter
}

// Screens get data access from here, so tests can swap in fakes. Provided in main.tsx.
export const ReposContext = createContext<Repos | null>(null)

export function useRepos(): Repos {
  const repos = useContext(ReposContext)

  if (!repos) {
    throw new Error('useRepos must be used inside ReposContext')
  }

  return repos
}
