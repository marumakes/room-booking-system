import { useEffect, useState } from 'react'
import type { SignedInUser } from '../domain/auth'
import type { Profile } from '../domain/profile'
import { DisplayNamePage } from './DisplayNamePage'
import { PROFILE_FAILURE_MESSAGES } from './messages'
import { useRepos } from './repos'
import { Screen, primaryButtonClass } from './Screen'
import { SignInPage } from './SignInPage'
import { SignedInApp } from './SignedInApp'
import { Visit } from './visit'

const ProfileStatus = {
  Loading: 'loading',
  Missing: 'missing',
  Ready: 'ready',
  Failed: 'failed',
} as const

type ProfileView =
  | { status: typeof ProfileStatus.Loading }
  | { status: typeof ProfileStatus.Missing }
  | { status: typeof ProfileStatus.Ready; profile: Profile }
  | { status: typeof ProfileStatus.Failed; message: string }

// undefined = still checking for a stored session.
type UserView = SignedInUser | null | undefined

// Picks the screen: loading → sign in → set display name → rooms.
// Works at any URL, so a shared link survives signing in.
export function App() {
  const { auth, profiles } = useRepos()
  const [user, setUser] = useState<UserView>(undefined)
  const [loaded, setLoaded] = useState<{ userId: string; view: ProfileView } | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  // The user who has just picked their display name (first sign-in), to greet them with the welcome.
  const [newUserId, setNewUserId] = useState<string | null>(null)

  // Follows sign-in state for the life of the app.
  useEffect(() => auth.onUserChange(setUser), [auth])

  // Loads the signed-in user's profile; ignores the result if they signed out meanwhile.
  const userId = user?.id
  useEffect(() => {
    if (!userId) {
      return
    }

    let current = true

    void profiles.getProfile(userId).then((result) => {
      if (!current) {
        return
      }

      if (!result.ok) {
        setLoaded({ userId, view: { status: ProfileStatus.Failed, message: PROFILE_FAILURE_MESSAGES[result.failure] } })
        return
      }

      setLoaded({
        userId,
        view: result.profile
          ? { status: ProfileStatus.Ready, profile: result.profile }
          : { status: ProfileStatus.Missing },
      })
    })

    return () => {
      current = false
    }
  }, [profiles, userId, reloadCount])

  function retryProfile() {
    setLoaded(null)
    setReloadCount((n) => n + 1)
  }

  if (user === undefined) {
    return <Screen title="Loading…">{null}</Screen>
  }

  if (user === null) {
    return <SignInPage />
  }

  // A profile loaded for a previous user counts as still loading.
  const profileView: ProfileView =
    loaded && loaded.userId === user.id ? loaded.view : { status: ProfileStatus.Loading }

  switch (profileView.status) {
    case ProfileStatus.Loading:
      return <Screen title="Loading…">{null}</Screen>

    case ProfileStatus.Missing:
      return (
        <DisplayNamePage
          user={user}
          onSaved={(profile) => {
            setNewUserId(user.id)
            setLoaded({ userId: user.id, view: { status: ProfileStatus.Ready, profile } })
          }}
        />
      )

    case ProfileStatus.Failed:
      return (
        <Screen title="Couldn’t load your details">
          <p role="alert">{profileView.message}</p>
          <button type="button" className={primaryButtonClass} onClick={retryProfile}>
            Try again
          </button>
        </Screen>
      )

    case ProfileStatus.Ready:
      return (
        <SignedInApp
          profile={profileView.profile}
          visit={newUserId === user.id ? Visit.First : Visit.Returning}
          onProfileChange={(profile) => setLoaded({ userId: user.id, view: { status: ProfileStatus.Ready, profile } })}
        />
      )
  }
}
