# Pace of Play Ratings

Golf club members rate their playing partners' pace of play after each round. Ratings are anonymous and released once a month.

## How it works

1. **Tee times come in.** The secretary uploads the tee sheet as a CSV, or the booking system sends it automatically to `/api/v1/import`.
2. **A message goes out 5 hours after the tee time.** A text or email with a one-tap link, unique to that member and that round. No app or password. Anything due between 9pm and 8am waits until 9am.
3. **Members rate each partner 1 to 5 stars.** The stars light up as you hover or tap. 1 or 2 stars needs a reason, which goes to the secretary. A note is optional otherwise. Players can be skipped.
4. **The secretary reviews low ratings.** Accept, accept and send the member a friendly pace reminder, or dismiss. A low rating only counts once accepted. The review page warns when someone keeps rating the same people down while other members rate them well.
5. **Ratings are released on the 1st of each month.** A member's score is the average of the last 3 months of ratings, and only shows once they have 5 or more. Nobody ever sees who rated them.
6. **Members sign in to a dashboard** with a link sent to their email or phone. They can search any member, sort by lowest rated, see their own score and monthly history, and check the players in their next tee time.

## Data protection (UK GDPR)

The club is the data controller; this service is its processor. In the code:

- Only the data needed is stored: name, member number, handicap, email, mobile, who played together, and ratings.
- Rounds and ratings are deleted automatically after 18 months (`KEEP_MONTHS` in `src/lib/release.ts`).
- Every message has a "stop these messages" link. Secretaries can turn messages off, mark members as left, or delete a member and every rating linked to them (right to erasure).
- Links and sessions are stored only as one-way hashes. Row level security is on for every table, so Supabase's public API keys can't read anything.
- A plain-English privacy page is at `/privacy`.

Before going live you'll still need a data processing agreement with each club and a privacy notice in your own company's name. A solicitor or the ICO's templates can help.

## Running it on your own computer

Needs Node.js 22 and a Postgres database.

```
npm install
cp .env.example .env.local        # then fill in DATABASE_URL
npm run db:migrate                # creates the tables
npm run db:seed                   # optional: a made-up demo club
npm run dev                       # open http://localhost:3000
```

Without Twilio or Resend keys, texts and emails are printed in the terminal, and the sign-in page shows the link directly.

Demo sign-ins after `db:seed`: `tom.harland@fernhill.example` (member) and `secretary@fernhill.example` (secretary).

## Adding a real club

```
npm run club:create -- "Fernhill Golf Club" fernhill "Jane Smith" jane@fernhillgc.co.uk
```

The secretary can then sign in and upload the member list and tee times from the Secretary pages.

## Going live

| Service | What it does | Cost |
| --- | --- | --- |
| Vercel | Runs the website | Free to start |
| Supabase | The database | Free to start |
| Resend | Sends emails | Free up to 3,000 a month |
| Twilio | Sends texts (optional) | About 4p a text |

1. In Supabase, make a project in the London region. Copy the "Transaction pooler" connection string.
2. Run `DATABASE_URL=... npm run db:migrate` once against it.
3. In Vercel, import this GitHub repository and add the settings from `.env.example`.
4. In GitHub, add `APP_URL` and `CRON_SECRET` as repository secrets and a repository variable `CRON_ENABLED` = `true`. The "Scheduled jobs" workflow then runs every 15 minutes.

## Booking system API

```
POST /api/v1/import
Authorization: Bearer <club API key from the Secretary settings page>

{ "members":   [{ "member_id": "1001", "name": "Tom Harland", "email": "tom@example.com", "mobile": "07700900123", "handicap": "9" }],
  "tee_times": [{ "booking_ref": "B1042", "start": "2026-11-22 09:40", "course": "Old Course", "member_ids": ["1001", "1002"] }] }
```

Times without a time zone are read as the club's local time.

## Where things live

- `src/lib/rules.ts` the rating rules: star words, low-rating reasons, validation and the pattern check
- `src/lib/release.ts` the monthly release and data deletion
- `src/lib/invites.ts` sending the after-round messages
- `src/components/RatingForm.tsx` the star rating screen
- `src/app/dashboard` member dashboard, `src/app/secretary` secretary pages
- `db/migrations` database tables. Add a new numbered file for any change.

## Checks

`npm run lint` (type check), `npm test` (set `TEST_DATABASE_URL` to an empty database to include the full end-to-end run), `npm run build`. GitHub runs all three on every pull request.
