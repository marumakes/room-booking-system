# Room booking system

A mobile-first web app for sharing out a block of booked rooms among the people who need them. I built it for a university society whose members run weekly sessions in rooms the society books each term. Before this, members had to use a shared spreadsheet, which became very confusing very quickly.

This repo shows it set up for a fictional **Astronomy Society**, with made-up rooms and people.

| Room grid (desktop)                           | Week view (phone)                                        | Claiming a room                                  |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| ![Room grid](docs/screenshots/grid-light.png) | ![Week view on a phone](docs/screenshots/phone-week.png) | ![Claim sheet](docs/screenshots/phone-claim.png) |

| Dark mode                                                 | Sign-in                                               |
| --------------------------------------------------------- | ----------------------------------------------------- |
| ![Room grid in dark mode](docs/screenshots/grid-dark.png) | ![Sign-in screen](docs/screenshots/phone-sign-in.png) |

## What it does

**For hosts** (the people running sessions):

- Sign in with a 6-digit code sent to their university email (no password, and only one email domain is allowed).
- See every room, week by week on a phone or as a whole-term grid on a larger screen, updating live as other people claim.
- Claim a room for a night, either shared (up to 2 hosts) or as a quiet room for one group, or claim every week at once.
- Release claims and add sessions to their calendar (`.ics`).

**For the committee:**

- Clear anyone's claim and read the full claim history.
- Set a closing time, after which nothing can be claimed or released.
- Download an editable `.xlsx`.

## How it works

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router |
| Styling  | Tailwind CSS 4                           |
| Backend  | Supabase (Postgres, Auth, Realtime)      |

There's no custom server - all the business rules live in the database, so they hold whatever the client does:

- **Row-level security on every table.** Signed-out visitors can read nothing, and signed-in users can read rooms and claims but not write them directly.
- **Claims go through database functions** (`claim_slot`, `claim_series`, `release_*`, `clear_claim`). They enforce the rules (one room per host per night, room capacity, no claims on past or cancelled sessions or after closing) and report problems as reason codes (`room_full`, `claims_closed`, …) that the app turns into plain-English messages.
- **Safe when everyone claims at once.** Each claim locks its room's row, each host's claims run one at a time, and "every week" claims lock in date order so they can't block each other.
- **The claim history is written by triggers,** so nothing can skip being logged. Names are recorded as they were at the time.
- **Sign-up is restricted by a Supabase Auth hook,** with the access rules checking the email domain again as a backstop.

## Running it locally

You need Node 20+, Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
npm install
supabase start                      # local Postgres, Auth, Realtime and a mail catcher
cp .env.example .env.development.local
# paste PUBLISHABLE_KEY from `supabase status` into .env.development.local
npm run dev:claims                  # optional: six fake hosts with a spread of claims
npm run dev
```

Sign in with any `name@university.example` address. The code arrives in the local mail catcher at http://127.0.0.1:54324.

To make yourself committee, run this in Supabase Studio (http://127.0.0.1:54323) or in `psql`, once you've signed in:

```sql
insert into public.committee (user_id)
select id from auth.users where email = 'you@university.example';
```

To use it for your own rooms, see [docs/customising.md](docs/customising.md).
