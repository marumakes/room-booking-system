import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { AuthRepo, SignedInUser } from '../domain/auth'
import type { ClaimsRepo } from '../domain/claims'
import type { FileSaver } from '../domain/files'
import type { HistoryEntry, HistoryRepo } from '../domain/history'
import { ViewerRole, type ProfileRepo } from '../domain/profile'
import type { RoomsData, RoomsRepo } from '../domain/rooms'
import type { SpreadsheetWriter } from '../domain/spreadsheet'
import { ReposContext, type Repos } from '../ui/repos'
import { LocationProbe } from './LocationProbe'

export const TEST_USER: SignedInUser = { id: 'user-1', email: 'alex@university.example' }

// Auth fake whose calls succeed by default; tests override individual methods.
export function fakeAuth(overrides: Partial<AuthRepo> = {}): AuthRepo {
  return {
    requestCode: vi.fn().mockResolvedValue({ ok: true }),
    verifyCode: vi.fn().mockResolvedValue({ ok: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    onUserChange: vi.fn(() => () => {}),
    ...overrides,
  }
}

// Profile fake: no profile yet, and creating one succeeds.
export function fakeProfiles(overrides: Partial<ProfileRepo> = {}): ProfileRepo {
  return {
    getProfile: vi.fn().mockResolvedValue({ ok: true, profile: null }),
    createProfile: vi.fn(async (userId: string, displayName: string) => ({
      ok: true as const,
      profile: { userId, displayName },
    })),
    renameProfile: vi.fn(async (userId: string, displayName: string) => ({
      ok: true as const,
      profile: { userId, displayName },
    })),
    getRole: vi.fn().mockResolvedValue(ViewerRole.Host),
    ...overrides,
  }
}

export type FakeRoomsRepo = RoomsRepo & {
  // Simulates a live-update notification, as if another host just claimed or released.
  emitChange: () => void
}

// Rooms fake that serves the given sessions and claims.
export function fakeRooms(data: RoomsData = { sessions: [], claims: [], closesAt: null }, overrides: Partial<RoomsRepo> = {}): FakeRoomsRepo {
  const listeners = new Set<() => void>()

  return {
    loadRooms: vi.fn().mockResolvedValue({ ok: true, data }),
    onChange: vi.fn((callback: () => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    emitChange: () => listeners.forEach((listener) => listener()),
    ...overrides,
  }
}

// Claims fake whose calls succeed by default.
export function fakeClaims(overrides: Partial<ClaimsRepo> = {}): ClaimsRepo {
  return {
    claimSlot: vi.fn().mockResolvedValue({ ok: true }),
    claimSeries: vi.fn().mockResolvedValue({ ok: true }),
    releaseClaim: vi.fn().mockResolvedValue({ ok: true, released: 1 }),
    releaseSeries: vi.fn().mockResolvedValue({ ok: true, released: 1 }),
    clearClaim: vi.fn().mockResolvedValue({ ok: true, released: 1 }),
    setClosingTime: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

// History fake serving the given entries (newest first).
export function fakeHistory(entries: HistoryEntry[] = []): HistoryRepo {
  return { loadHistory: vi.fn().mockResolvedValue({ ok: true, entries }) }
}

export function fakeFiles(): FileSaver {
  return { save: vi.fn() }
}

// Spreadsheet fake returning a placeholder file.
export function fakeSpreadsheets(): SpreadsheetWriter {
  return { toXlsx: vi.fn().mockResolvedValue({ ok: true, file: new Blob(['xlsx']) }) }
}

// Renders a screen at a URL with fake data access.
export function renderWithRepos(ui: ReactElement, repos: Partial<Repos> = {}, url = '/') {
  const value: Repos = {
    auth: fakeAuth(),
    profiles: fakeProfiles(),
    rooms: fakeRooms(),
    claims: fakeClaims(),
    files: fakeFiles(),
    history: fakeHistory(),
    spreadsheets: fakeSpreadsheets(),
    ...repos,
  }
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <ReposContext value={value}>
        {ui}
        <LocationProbe />
      </ReposContext>
    </MemoryRouter>
  )
  return { ...render(tree), repos: value }
}
