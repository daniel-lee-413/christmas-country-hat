# Christmas Country Hat

Players open the link, type their name, and put one country in the hat.
When everyone's in, the host closes the hat and each person draws a country.
Nobody can get their own, and nobody gets stuck at the end.

Host view: add `?host` to the end of the link, e.g. `https://your-site.vercel.app/?host`

## Put it live on Vercel (about 10 minutes, free)

1. **Upload the project**: Vercel dashboard → Add New → Project → import from GitHub
   (push this folder to a new repo first), or run `npx vercel` inside this folder.
   No build settings needed; leave everything as default.
2. **Add the database**: in the project, open the **Storage** tab → Create Database →
   **Upstash for Redis** (free plan) → connect it to this project.
   This adds the connection settings automatically.
3. **Set the host password**: Settings → Environment Variables → add
   `HOST_PASSWORD` with a password of your choice.
4. **Redeploy**: Deployments tab → ⋯ on the latest one → Redeploy
   (so it picks up the database and password).
5. Test it: open `/?host`, enter the password, then add a country from your phone.
   Use **Reset everything** afterwards to clear the test.

## On the night (well, before it)

1. Send everyone the link. Each person adds their name and a country.
2. When all 5 are in, the host opens `/?host` and taps **Close the hat**.
3. Everyone opens the link again and taps **Draw from the hat**.

Players are remembered by their browser, so they should use the same phone or
laptop each time. If someone switches device, they'll appear as a new person.
