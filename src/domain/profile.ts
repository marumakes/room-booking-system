// Display-name contract between the UI and the data layer.
import { DataFailure } from './failure'

export type Profile = {
  userId: string
  displayName: string
}

export const ProfileFailure = {
  ...DataFailure,
  NameTaken: 'name_taken',
} as const
export type ProfileFailure = (typeof ProfileFailure)[keyof typeof ProfileFailure]

// Committee members can also clear other hosts' claims and read the claim history.
export const ViewerRole = {
  Host: 'host',
  Committee: 'committee',
} as const
export type ViewerRole = (typeof ViewerRole)[keyof typeof ViewerRole]

export type ProfileResult =
  | { ok: true; profile: Profile | null }
  | { ok: false; failure: ProfileFailure }

export interface ProfileRepo {
  // The user's profile, or null if they haven't set a display name yet.
  getProfile(userId: string): Promise<ProfileResult>

  // Sets the display name on first sign-in.
  createProfile(userId: string, displayName: string): Promise<ProfileResult>

  // Changes an existing display name.
  renameProfile(userId: string, displayName: string): Promise<ProfileResult>

  // The signed-in user's role. Host if it can't be checked, so nobody gets committee powers by accident.
  getRole(): Promise<ViewerRole>
}
