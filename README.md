# 💧 Water Reminder Telegram Bot

A lightweight, production-ready Node.js Telegram bot designed to help users maintain their daily hydration goals. It automatically sends a reminder to drink a glass of water every hour between **9:00 AM and 9:00 PM (Europe/Berlin timezone)**.

This project is tailored for rapid cloud deployment (Render/Railway) and follows best practices for clean, modern backend development.

---

## 🚀 Key Features

* **Automated Hourly Scheduling:** Uses `node-cron` to trigger reminders strictly at the top of every hour within the active window (09:00 - 21:00).
* **Timezone Aware Execution:** Locked to `Europe/Berlin` to ensure reminders perfectly match the user's local time and don't disturb them during the night.
* **Smart Memory Management:** Manages active subscriptions efficiently using an in-memory `Set` with automatic cleanup for blocked or inactive chats to prevent memory leaks.
* **Graceful Shutdown Protocols:** Properly listens to `SIGINT` and `SIGTERM` system signals to close the Telegram polling connection safely without cutting off active requests.
* **Production-Ready Security:** Keeps sensitive API tokens strictly isolated using environment variables (`.env`), explicitly protected via `.gitignore`.

---

## 🛠️ Tech Stack

* **Runtime Environment:** Node.js (v18+, utilizing ES Modules syntax)
* **Telegram API Framework:** [Telegraf.js](https://github.com/telegraf/telegraf) (Modern, robust Telegram Bot API wrapper)
* **Task Scheduler:** [node-cron](https://github.com/node-cron/node-cron) (Pure JavaScript tiny cron-like job scheduler)
* **Configuration Management:** [dotenv](https://github.com/motdotla/dotenv) (Loads environment variables from `.env`)

---

## 📦 Architecture & Workflow

The bot architecture follows clean engineering principles, isolating core subscription logic from the automated scheduling layer. This structure makes it incredibly simple to scale or plug in a persistent database layer (like MongoDB/Mongoose) later:

1. **Subscription Layer:** When a user sends the `/start` command, the bot extracts and registers their unique `chatId` to a tracking collection.
2. **Cron Scheduler Layer:** The background daemon constantly evaluates the time rule `0 9-21 * * *` against the target timezone (`Europe/Berlin`).
3. **Execution Layer:** At the exact minute mark, the bot iterates over active subscribers and dispatches customized Telegram messages asynchronously using robust error handling.

---

## 💻 Local Setup & Installation

### Prerequisite
Make sure you have Node.js (v18+) installed locally and a secure Telegram Bot token generated via @BotFather.

1. **Clone the repository:**
   git clone https://github.com/YOUR_USERNAME/water-reminder-bot.git
   cd water-reminder-bot

2. **Install project dependencies:**
   npm install telegraf node-cron dotenv

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   BOT_TOKEN=your_secret_telegram_bot_token_here

4. **Verify Modern Syntax Configuration:**
   Ensure your `package.json` includes the following line right below your entry point to enable ES Modules:
   "type": "module"

5. **Start the bot locally:**
   node index.js

---

## ☁️ Deployment Guide (Render / Railway)

This bot is fully optimized to run 24/7 as a background worker or non-sleeping web service in the cloud.

1. **Push to GitHub:** Push your codebase to a public or private GitHub repository. **Crucial:** Verify that your `.env` file is successfully ignored by checking your `.gitignore` rules.
2. **Connect to Hosting:** Log in to Render.com or Railway using your GitHub account credentials.
3. **Create Service:** Create a new Web Service or Background Worker and link it to the `water-reminder-bot` repository.
4. **Define Build Settings:** Enter the following parameters during the setup wizard:
   * Runtime: Node
   * Build Command: npm install
   * Start Command: node index.js
5. **Inject Secrets:** Head over to the Environment Variables tab, click Add Variable, and paste your token:
   * Key: BOT_TOKEN
   * Value: [Your actual secret token string from BotFather]
6. **Trigger Deploy:** Click Deploy Web Service. The platform will automatically spin up your instance, install dependencies, inject the credentials, and execute the server.

---

## 📜 License
This project is licensed under the MIT License. Feel free to use, fork, modify, or bundle this code for your personal usage, tutorials, or portfolio presentations.