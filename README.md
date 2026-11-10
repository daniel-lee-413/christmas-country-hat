# Christmas Country Hat

Each friend opens the link on their own phone, adds their name and one country.
Nobody can see anyone else's country, not even the organiser. The organiser closes
entries and runs the draw. Everyone gets one country, nobody gets their own, and each
person sees only their own result. The organiser gets an email when the draw is done
(names only, no countries).

- Player link: `https://christmas-country-hat.vercel.app/`
- Organiser link: `https://christmas-country-hat.vercel.app/?host`

## Vercel settings (Settings → Environment Variables)

| Name | What it is |
|---|---|
| `HOST_PASSWORD` | Organiser password |
| `RESEND_API_KEY` | Resend API key (sending access is enough) |
| `ORGANISER_EMAIL` | Where the "draw is done" email goes (comma-separate for more than one) |
| `EMAIL_FROM` | Optional. Defaults to `Christmas Country Hat <hat@fantasyfundmanager.co.uk>` |
| Upstash database settings | Added automatically when the Upstash database is connected |

Redeploy after changing any setting.

## Running it

1. Share the player link. Each person adds their name and country **on the phone they'll use later**.
2. Organiser: open the organiser link → **Close entries** → **Run the draw** (tap twice to confirm).
3. Everyone opens the link and taps **Reveal my country**.
4. **New round** (tap twice) wipes everything to start again.

If someone's missing after entries close, tap **Reopen entries** (only before the draw).
