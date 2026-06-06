# Aquatic Centre — Legacy Thermometer 🏊

A live fundraising dashboard for the **Greensprings Aquatic Centre — Legacy Fund**
(target **₦2,000,000,000**). It shows a realistic glass thermometer with a graduated scale
(percentages + naira amounts) tracking the **target**, **amount pledged**, and **amount
fulfilled**; a public **pledge form** reachable by **QR code**; optional **email notifications**
on every pledge; **CSV export**; and a password-protected **admin backend**. Styled to
Greensprings School branding (logo, school green + red accent) with a pool-blue water fill.

## What's included

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | The thermometer. Scale lines show 0/25/50/75/100% with the matching ₦ amounts; the water level = pledged, a dashed line marks fulfilled. Live QR code. Auto-refreshes every 5s. |
| Pledge form | `/pledge` | Public form (name, email, phone, child's name, amount, optional message). Submitting it instantly raises the **pledged** total. |
| Admin | `/admin` | Password-protected. Edit target/name/currency, record **fulfilled** amounts per pledge, delete pledges, and **export all pledges to CSV**. |

The QR code on the dashboard points to `/pledge` on whatever domain you deploy to, so it works on any phone.

## Run it locally

```bash
cd aquatic-centre
npm install
ADMIN_PASSWORD=yourpassword npm start
```

Then open http://localhost:3000 . The pledge form is at `/pledge` and the admin at `/admin`.

> The QR code uses the current domain. On `localhost` a phone can't reach it — that's expected.
> Once deployed to a public URL, the QR works for everyone.

## Deploy (free) so the QR works on phones

### Option A — Render (recommended, keeps data on a disk)
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` is already configured (Node web service + 1 GB disk for the data file).
3. Set the `ADMIN_PASSWORD` env var to your own secret (and the SMTP vars if you want email).
4. Deploy. Your dashboard is at `https://<your-app>.onrender.com/`.

### Option B — Railway
1. New project → Deploy from GitHub repo.
2. Add a Volume mounted at `/var/data` and set `DB_PATH=/var/data/legacy.json`.
3. Set `ADMIN_PASSWORD`. Deploy.

> Note: plain **Vercel/Netlify serverless** doesn't keep a data file between requests.
> Use Render or Railway (or any always-on Node host) so pledges persist.

## Email notifications (optional)

Set these env vars and every new pledge emails a summary to your team. Leave them unset to
disable. Any SMTP provider works; Gmail needs an **App Password**.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
NOTIFY_TO=fundraising@greenspringsschool.com
NOTIFY_FROM=Aquatic Centre Fund <your-account@gmail.com>
```

## CSV export

In `/admin`, click **Export CSV** to download every pledge (donor, contact, child's name,
amount, fulfilled, status, message, date). The file opens cleanly in Excel/Sheets, including
the ₦ symbol.

## Configuration (env vars)

- `ADMIN_PASSWORD` — password for `/admin`. **Change this before going live.**
- `PORT` — defaults to 3000.
- `DB_PATH` — path to the JSON data file. On a host, point it at a mounted disk so data survives restarts.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_TO`, `NOTIFY_FROM` — email notifications.

## How the numbers work

- **Pledged** = sum of every pledge submitted through `/pledge` (the water level).
- **Fulfilled** = sum of the fulfilled amounts you record in `/admin` — what's actually been collected (the dashed line).

## First steps after deploy
1. Open `/admin`, sign in. The defaults are already set (Aquatic Centre name + ₦2bn target) — adjust if needed.
2. Display `/` on a screen at your event — people scan the QR to pledge.
3. As money comes in, open `/admin` and update the **Fulfilled** field for each pledge.
