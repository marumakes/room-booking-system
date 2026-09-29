# Using it for your own rooms

## 1. Put your bookings in a CSV

`seed-data/sessions.csv` has one line per room per night:

```csv
date,day,room
2026-10-06,Tuesday,Harcourt 1.04
2026-10-06,Tuesday,Harcourt 1.06
2026-10-09,Friday,Harcourt 1.04
```

- **Days:** any weekday works, and the day tabs show whichever days appear.
- **Room order:** rooms are displayed in the order they first appear in the file.
- **Part-term rooms:** a room missing from some weeks is marked "Not every week" automatically.

If your bookings come as PDFs from a venue, copy the tables into a spreadsheet and save as CSV. Tables from PDFs rarely paste cleanly, but the next step catches any mistakes.

## 2. Check and load it

```sh
node scripts/build-seed.mjs   # checks every line and writes supabase/seed.sql
supabase db reset             # local: rebuilds the database and loads the seed
```

The checker stops at the first problem and names the line: a bad date, a day that doesn't match its date, a duplicate room on the same night, or a blank room. For a hosted project, run `supabase/seed.sql` in the SQL editor. It's safe to re-run.

## 3. Change the settings

| Setting                                                                 | Where                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Name, contact, email domain, time zone, session times, calendar details | `src/config.ts`                                                                               |
| Allowed email domain (enforced at sign-up)                              | `private.allowed_email_domain()` in `supabase/migrations/20260924130300_auth_domain_hook.sql` |
| Time zone for "today" in the database                                   | `private.site_time_zone()` in `supabase/migrations/20260924130200_claims.sql`                 |
| Logo and favicon                                                        | `src/assets/logo.svg`, `public/`                                                              |
| Sign-in email                                                           | `supabase/templates/sign-in-code.html` and the email subjects in `supabase/config.toml`       |

The email domain and time zone appear in both the app and the database. Change them in both places.

## 4. Deploying

1. Create a Supabase project and run `supabase db push`.
2. Turn on the "Before user created" auth hook (`public.hook_restrict_signup_domain`).
3. Set up email: the sign-in code template, plus an SMTP provider for real volumes.
4. Deploy the frontend to any static host with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set. Send every path to `index.html`, so links to a day or week work.

## 5. End of term

1. Set a closing time.
2. Download the spreadsheet.
3. Delete everyone's data: `truncate public.sessions, public.claim_history cascade;`, then delete the users under Authentication → Users.

The in-app privacy note tells users this happens.
