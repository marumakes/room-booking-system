// @vitest-environment node
// Real sign-in against the local Supabase stack. Needs `supabase start`; run with `npm run test:integration`.
import { afterEach, describe, expect, it } from 'vitest'
import { AuthFailure } from '../domain/auth'
import { ProfileFailure } from '../domain/profile'
import { SEEDED_SESSION_COUNT, readCode, signIn, signedInAs } from '../test/localSupabase'
import { supabaseAuthRepo } from './authRepo'
import { supabaseProfileRepo } from './profileRepo'
import { supabaseRoomsRepo } from './roomsRepo'

describe('sign-in against local Supabase', () => {
  // Unique per run: names are unique and earlier runs' users stay in the local database.
  const run = Date.now()
  const email = `it-${run}@university.example`
  const name = `Integration ${run}`

  // A failed test must not leave its session behind for the next one.
  afterEach(async () => {
    await supabaseAuthRepo.signOut()
  })

  it('rejects a outside-domain email at the server', async () => {
    const result = await supabaseAuthRepo.requestCode(`it-${Date.now()}@gmail.com`)
    expect(result).toEqual({ ok: false, failure: AuthFailure.NotAllowedEmail })
  })

  it('signs in with the emailed code and sets a display name', async () => {
    expect(await supabaseAuthRepo.requestCode(email)).toEqual({ ok: true })
    const code = await readCode(email)

    // A wrong code is refused before the right one is tried.
    const wrong = code === '000000' ? '111111' : '000000'
    expect(await supabaseAuthRepo.verifyCode(email, wrong)).toEqual({ ok: false, failure: AuthFailure.CodeInvalid })

    const signedIn = signedInAs(email)
    expect(await supabaseAuthRepo.verifyCode(email, code)).toEqual({ ok: true })
    const user = await signedIn
    expect(user.email).toBe(email)

    expect(await supabaseProfileRepo.getProfile(user.id)).toEqual({ ok: true, profile: null })
    expect(await supabaseProfileRepo.createProfile(user.id, name)).toEqual({
      ok: true,
      profile: { userId: user.id, displayName: name },
    })

    // A double submit keeps the first name rather than failing.
    expect(await supabaseProfileRepo.createProfile(user.id, `${name} again`)).toEqual({
      ok: true,
      profile: { userId: user.id, displayName: name },
    })
  })

  it('loads the seeded rooms and refuses a display name already in use', async () => {
    const firstEmail = `it-a-${run}@university.example`
    const secondEmail = `it-b-${run}@university.example`
    const sharedName = `Clash ${run}`

    const first = await signIn(firstEmail)
    await supabaseProfileRepo.createProfile(first.id, sharedName)
    await supabaseAuthRepo.signOut()

    const second = await signIn(secondEmail)
    expect(await supabaseProfileRepo.createProfile(second.id, sharedName.toUpperCase())).toEqual({
      ok: false,
      failure: ProfileFailure.NameTaken,
    })

    await supabaseProfileRepo.createProfile(second.id, `${sharedName} B`)
    expect(await supabaseProfileRepo.renameProfile(second.id, ` ${sharedName.toLowerCase()} `)).toEqual({
      ok: false,
      failure: ProfileFailure.NameTaken,
    })

    const rooms = await supabaseRoomsRepo.loadRooms()
    expect(rooms.ok && rooms.data.sessions.length).toBe(SEEDED_SESSION_COUNT)
  })
})
