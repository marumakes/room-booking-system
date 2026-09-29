import type { SignedInUser } from '../domain/auth'
import type { Profile } from '../domain/profile'
import { DisplayNameForm } from './DisplayNameForm'
import { useRepos } from './repos'
import { Screen } from './Screen'

type DisplayNamePageProps = {
  user: SignedInUser
  onSaved: (profile: Profile) => void
}

// First sign-in only: the name other hosts see on claimed rooms instead of the email.
export function DisplayNamePage({ user, onSaved }: DisplayNamePageProps) {
  const { profiles } = useRepos()

  return (
    <Screen title="What should we call you?">
      <DisplayNameForm
        submitLabel="Continue"
        save={(name) => profiles.createProfile(user.id, name)}
        onSaved={onSaved}
      />
    </Screen>
  )
}
