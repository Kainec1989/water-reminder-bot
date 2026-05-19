# 💧 Water Reminder Telegram Bot

A lightweight Node.js Telegram bot that reminds you to drink water every hour between **9:00 and 21:00 (Europe/Berlin)**.

Features i18n (DE / RU / EN), a `/next` countdown, JSON persistence for subscribers, and deployment on Render without Linux `tzdata` in the container.

---

## Key features

* **Hourly reminders (Berlin time):** Cron runs on UTC; each tick checks the current hour in `Europe/Berlin` via `Intl` and sends only between 09:00–21:00 (works in winter CET and summer CEST).
* **i18n:** Detects Telegram `language_code` (with locale prefixes and `uk` → `ru`).
* **`/next`:** Countdown to the next reminder in the user’s language.
* **Persistent subscribers:** `data/subscribers.json` survives process restarts (optional `DATA_DIR` on Render disk).
* **Graceful shutdown:** Stops cron, flushes subscribers to disk, closes HTTP, stops Telegraf.

---

## Scheduling (how it works)

| Layer | Mechanism |
|--------|-----------|
| **Cron** | `0 6-21 * * *` in **UTC** (no `timezone` option — avoids silent failures without `tzdata` on Render) |
| **Gate** | Before sending, `Intl` checks Berlin local hour is **9–21** |
| **`/next`** | Same Berlin clock via `Intl` |

This keeps reminders aligned with `/next` year-round without `node-cron` timezone support.

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | yes | — | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `PORT` | no | `3000` | HTTP health check (Render sets this automatically) |
| `DATA_DIR` | no | `./data` | Directory for `subscribers.json` |

---

## Local setup

1. **Clone and install**
   ```bash
   git clone https://github.com/YOUR_USERNAME/water-reminder-bot.git
   cd water-reminder-bot
   npm install
   ```

2. **Configure `.env`**
   ```
   BOT_TOKEN=your_secret_telegram_bot_token_here
   ```

3. **Run**
   ```bash
   npm start
   ```

Subscribers are stored in `data/subscribers.json` (gitignored).

---

## Deploy on Render

1. Push to GitHub (`.env` must stay out of the repo).
2. Create a **Web Service**, connect the repo.
3. **Build:** `npm install` · **Start:** `npm start`
4. Add `BOT_TOKEN` in Environment.
5. **Optional — keep subscribers across redeploys:** add a [Persistent Disk](https://render.com/docs/disks), mount e.g. at `/data`, set `DATA_DIR=/data`.

Without a disk, subscribers survive **restarts** of the same instance but are lost on **new deploys** (ephemeral filesystem).

Do **not** use `node-cron` `{ timezone: "Europe/Berlin" }` on minimal Docker images unless `tzdata` is installed — the job may never run.

---

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Subscribe to hourly reminders |
| `/stop` | Unsubscribe |
| `/next` | Time until next reminder (subscribers only) |

---

## License

MIT
