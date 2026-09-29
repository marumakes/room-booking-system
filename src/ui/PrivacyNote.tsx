import { SITE } from '../config'
import { Sheet } from './Sheet'

type PrivacyNoteProps = {
  onClose: () => void
}

const sectionHeadingClass = 'text-xs font-medium uppercase tracking-wider text-muted'

// What the app stores, who handles it and when it's deleted. Reachable from every screen's footer,
// including sign-in, so people can read it before giving their email.
export function PrivacyNote({ onClose }: PrivacyNoteProps) {
  return (
    <Sheet title="What we store and why" onClose={onClose}>
      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h3 className={sectionHeadingClass}>What we store</h3>
          <ul className="mt-2 space-y-2">
            <li>
              <strong>Your university email</strong>: only to send your sign-in code. Other hosts never see it.
            </li>
            <li>
              <strong>Your display name</strong>: shown on the rooms you claim.
            </li>
            <li>
              <strong>Your claims</strong>: which rooms and nights you’ve claimed, visible to every signed-in host.
            </li>
            <li>
              <strong>Claim history</strong>: a log of every claim, release and committee clear (who, what, when). Only the
              committee can see it; it helps settle disputes.
            </li>
            <li>
              <strong>On your device</strong>: your sign-in session and theme choice, kept in your browser. No tracking or
              analytics.
            </li>
          </ul>
        </section>

        <section>
          <h3 className={sectionHeadingClass}>Who handles it</h3>
          <p className="mt-2">
            The data is stored with Supabase (database and sign-in) in Frankfurt, sign-in emails are sent through Resend,
            and the site is hosted on Vercel.
          </p>
        </section>

        <section>
          <h3 className={sectionHeadingClass}>When it’s deleted</h3>
          <p className="mt-2">
            Once sign-up closes, the committee exports the claims to a shared drive. Then all emails, names,
            claims and history are deleted from this app.
          </p>
        </section>

        <p className="rounded-2xl bg-sunk p-4">Questions, or want your data removed sooner? Speak to {SITE.contact}.</p>
      </div>
    </Sheet>
  )
}
