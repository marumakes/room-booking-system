import { useState } from 'react'
import { ViewerRole, type Profile } from '../domain/profile'
import { AccountMenu } from './AccountMenu'
import { Brand } from './Brand'
import { BrandSize } from './brandSize'
import { DisplayNameForm } from './DisplayNameForm'
import { useRepos } from './repos'
import { Sheet } from './Sheet'

type HeaderProps = {
  profile: Profile
  role: ViewerRole
  onProfileChange: (profile: Profile) => void
  onHowItWorks: () => void
}

// Top bar: logo on the left, the account menu on the right. Stays pinned while scrolling.
// Fixed height (h-16): the room grid's sticky header sits just below it.
export function Header({ profile, role, onProfileChange, onHowItWorks }: HeaderProps) {
  const { profiles } = useRepos()
  const [editingName, setEditingName] = useState(false)

  function onSaved(updated: Profile) {
    setEditingName(false)
    onProfileChange(updated)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand size={BrandSize.Small} />
        <AccountMenu
          profile={profile}
          committee={role === ViewerRole.Committee}
          onChangeName={() => setEditingName(true)}
          onHowItWorks={onHowItWorks}
        />
      </div>

      {editingName && (
        <Sheet title="Change name" onClose={() => setEditingName(false)}>
          <DisplayNameForm
            initialName={profile.displayName}
            submitLabel="Save name"
            save={(name) => profiles.renameProfile(profile.userId, name)}
            onSaved={onSaved}
            onCancel={() => setEditingName(false)}
          />
        </Sheet>
      )}
    </header>
  )
}
